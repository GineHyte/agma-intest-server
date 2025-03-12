// @ts-expect-error
import SQLite from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import config from './config.ts'
import { systemLogger } from './logger.ts'

// Define the database schema interface
export interface Database {
  session: {
    JWT: string
    YJBN: number
    YSYS: string
    YB: string
    YM: string
    expires: number
  }
  protocol: {
    id?: number
    JWT: string
    timestamp: number
    message?: string
    level: "info" | "warn" | "error"
  }
}

const dialect = new SqliteDialect({
  database: new SQLite(config.databasePath),
})

// Pass the Database interface as a type parameter
export const db = new Kysely<Database>({
  dialect,
  log(event) {
    // Do not log protocol queries
    if (event.query.sql.includes('protocol')) return
    if (event.level === 'error') {
      systemLogger.error(event.error)
    } else if (event.level === 'query') {
      systemLogger.log(event.query.sql + '  [' + JSON.stringify(event.queryDurationMillis) + 'ms]')
    }
  }
})

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable('session')
    .addColumn('JWT', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('YJBN', 'integer', (col) => col.notNull())
    .addColumn('YSYS', 'varchar(5)', (col) => col.notNull())
    .addColumn('YB', 'varchar(3)', (col) => col.notNull())
    .addColumn('YM', 'varchar(4)', (col) => col.notNull())
    .addColumn('expires', 'integer', (col) => col.notNull())
    .addColumn('createdAt', 'integer', (col) => col.notNull().defaultTo(Date.now()))
    .execute()

  await db.schema
    .createTable('protocol')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('JWT', 'varchar(255)', (col) => col.notNull())
    .addColumn('timestamp', 'integer', (col) => col.notNull().defaultTo(Date.now()))
    .addColumn('message', 'text', (col) => col)
    .addColumn('level', 'varchar(10)', (col) => col.notNull().defaultTo('info'))
    .addForeignKeyConstraint(
      'protocol_JWT_fk', ['JWT'], 'session', ['JWT'],
      (cb) => cb.onDelete('cascade').onUpdate('cascade')
    )
    .execute()
}

export async function initSystemSessionForLogging() {
  await db.insertInto('session')
    .values({
      "JWT": "system",
      "YJBN": 0,
      "YSYS": "SYSTEM",
      "YB": "000",
      "YM": "0000",
      "expires": 0
    })
    .execute()
}

export async function down(db: Kysely<any>) {
  await db.schema.dropTable('session').execute()
  await db.schema.dropTable('protocol').execute()
}