import { readFile } from 'node:fs/promises'
import { db } from '../server/db.js'

try {
    const schema = await readFile(new URL('../server/schema.sql', import.meta.url), 'utf8')
    await db.query(schema)
    console.log('数据库结构初始化完成')
} finally {
    await db.end()
}
