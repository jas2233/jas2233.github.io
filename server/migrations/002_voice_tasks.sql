CREATE TABLE IF NOT EXISTS voice_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id bigint NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id bigint NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    play_target text NOT NULL CHECK (play_target IN ('computer', 'mobile')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    text_ciphertext text NOT NULL,
    text_iv text NOT NULL,
    text_tag text NOT NULL,
    worker_id text,
    attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
    locked_at timestamptz,
    audio_path text,
    error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS voice_tasks_queue_idx
    ON voice_tasks (status, created_at);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'voice-audio',
    'voice-audio',
    false,
    52428800,
    ARRAY['audio/wav', 'audio/x-wav']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

REVOKE ALL ON voice_tasks FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON voice_tasks TO service_role;

CREATE OR REPLACE FUNCTION lucia_create_voice_task(
    p_message_id bigint,
    p_play_target text,
    p_text_ciphertext text,
    p_text_iv text,
    p_text_tag text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    found_conversation_id bigint;
    created voice_tasks%ROWTYPE;
BEGIN
    IF p_play_target NOT IN ('computer', 'mobile')
       OR length(coalesce(p_text_ciphertext, '')) < 1
       OR length(coalesce(p_text_iv, '')) < 1
       OR length(coalesce(p_text_tag, '')) < 1 THEN
        RAISE EXCEPTION 'invalid voice task';
    END IF;

    SELECT conversation_id INTO found_conversation_id
    FROM messages
    WHERE id = p_message_id AND role = 'assistant';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    INSERT INTO voice_tasks (
        conversation_id, message_id, play_target,
        text_ciphertext, text_iv, text_tag
    ) VALUES (
        found_conversation_id, p_message_id, p_play_target,
        p_text_ciphertext, p_text_iv, p_text_tag
    ) RETURNING * INTO created;

    RETURN jsonb_build_object(
        'status', 'ok',
        'task', jsonb_build_object(
            'id', created.id,
            'message_id', created.message_id::text,
            'play_target', created.play_target,
            'status', created.status,
            'created_at', created.created_at
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION lucia_get_voice_task(p_task_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
    SELECT jsonb_build_object(
        'id', id,
        'message_id', message_id::text,
        'play_target', play_target,
        'status', status,
        'audio_path', audio_path,
        'error', error,
        'created_at', created_at,
        'completed_at', completed_at
    )
    FROM voice_tasks
    WHERE id = p_task_id;
$$;

CREATE OR REPLACE FUNCTION lucia_claim_voice_task(p_worker_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    claimed voice_tasks%ROWTYPE;
BEGIN
    IF length(trim(coalesce(p_worker_id, ''))) NOT BETWEEN 1 AND 80 THEN
        RAISE EXCEPTION 'invalid worker id';
    END IF;

    WITH candidate AS (
        SELECT id
        FROM voice_tasks
        WHERE attempts < 3
          AND (
              status = 'pending'
              OR (status = 'processing' AND locked_at < now() - interval '15 minutes')
          )
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    )
    UPDATE voice_tasks task
    SET status = 'processing',
        worker_id = trim(p_worker_id),
        attempts = attempts + 1,
        locked_at = now(),
        updated_at = now(),
        error = NULL
    FROM candidate
    WHERE task.id = candidate.id
    RETURNING task.* INTO claimed;

    IF NOT FOUND THEN RETURN NULL; END IF;

    RETURN jsonb_build_object(
        'id', claimed.id,
        'play_target', claimed.play_target,
        'text_ciphertext', claimed.text_ciphertext,
        'text_iv', claimed.text_iv,
        'text_tag', claimed.text_tag
    );
END;
$$;

CREATE OR REPLACE FUNCTION lucia_prepare_voice_upload(p_task_id uuid, p_worker_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    path text;
BEGIN
    SELECT 'tasks/' || id::text || '.wav' INTO path
    FROM voice_tasks
    WHERE id = p_task_id
      AND status = 'processing'
      AND play_target = 'mobile'
      AND worker_id = p_worker_id;

    IF NOT FOUND THEN RETURN jsonb_build_object('status', 'invalid'); END IF;
    RETURN jsonb_build_object('status', 'ok', 'audio_path', path);
END;
$$;

CREATE OR REPLACE FUNCTION lucia_complete_voice_task(
    p_task_id uuid,
    p_worker_id text,
    p_audio_path text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE voice_tasks
    SET status = 'completed',
        audio_path = CASE WHEN play_target = 'mobile' THEN p_audio_path ELSE NULL END,
        completed_at = now(),
        updated_at = now(),
        locked_at = NULL
    WHERE id = p_task_id
      AND status = 'processing'
      AND worker_id = p_worker_id
      AND (
          (play_target = 'computer' AND p_audio_path IS NULL)
          OR (play_target = 'mobile' AND p_audio_path = 'tasks/' || id::text || '.wav')
      );
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION lucia_fail_voice_task(
    p_task_id uuid,
    p_worker_id text,
    p_error text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE voice_tasks
    SET status = 'failed',
        error = left(coalesce(p_error, 'unknown error'), 1000),
        updated_at = now(),
        locked_at = NULL
    WHERE id = p_task_id
      AND status = 'processing'
      AND worker_id = p_worker_id;
    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION lucia_create_voice_task(bigint, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION lucia_get_voice_task(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION lucia_claim_voice_task(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION lucia_prepare_voice_upload(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION lucia_complete_voice_task(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION lucia_fail_voice_task(uuid, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION lucia_create_voice_task(bigint, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION lucia_get_voice_task(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION lucia_claim_voice_task(text) TO service_role;
GRANT EXECUTE ON FUNCTION lucia_prepare_voice_upload(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION lucia_complete_voice_task(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION lucia_fail_voice_task(uuid, text, text) TO service_role;
