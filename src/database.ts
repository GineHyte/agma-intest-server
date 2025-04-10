// @ts-expect-error
import SQLite from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import config from './config.ts'
import { systemLogger } from './logger.ts'

/**
 * SQLite-Dialekt für die Kysely-Datenbankverbindung
 * @description Konfiguriert den SQLite-Dialekt mit dem angegebenen Datenbankpfad
 */
const dialect = new SqliteDialect({
  database: new SQLite(config.databasePath),
})

/**
 * Kysely-Datenbankinstanz für Anwendungsdatenbankoperationen
 * @type {Kysely<Database>}
 * @description Exportierte Datenbankinstanz mit Protokollierungsfunktionen
 */
// Übergeben Sie die Datenbankschnittstelle als Typparameter
export const db = new Kysely<Database>({
  dialect,
  log(event) {
    // Protokollabfragen nicht protokollieren
    if (event.query.sql.includes('protocol')) return
    if (event.level === 'error') {
      systemLogger.error(event.error)
    } else if (event.level === 'query') {
      // Optional: Nur langsame Queries loggen
      if (event.queryDurationMillis > 500) {
        systemLogger.log(`Langsame Abfrage: ${event.query.sql} [${JSON.stringify(event.queryDurationMillis)}ms]`);
      }
    }
  }
})

/**
 * Erstellt das Datenbankschema und die erforderlichen Tabellen
 * @param {Kysely<any>} db - Kysely-Datenbankinstanz
 * @returns {Promise<void>} Promise, das aufgelöst wird, wenn das Schema erstellt wurde
 * @description Initialisiert das Datenbankschema für die Anwendung
 */
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
    .addColumn('workerId', 'integer', (col) => col)
    .addForeignKeyConstraint(
      'protocol_JWT_fk', ['JWT'], 'session', ['JWT'],
      (cb) => cb.onDelete('cascade').onUpdate('cascade')
    )
    .execute()

  await db.schema
    .createTable('macro')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('userMacroId', 'varchar(255)', (col) => col.notNull())
    .addColumn('JWT', 'varchar(255)', (col) => col.notNull())
    .addColumn('resultMessage', 'text', (col) => col)
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
    .addColumn('screencastFlag', 'boolean', (col) => col.notNull().defaultTo(config.defaultScreencastFlag))
    .addColumn('screencastPath', 'text', (col) => col.notNull().defaultTo(config.defaultScreencastPath))
    .addColumn('logFlag', 'boolean', (col) => col.notNull().defaultTo(config.defaultLogFlag))
    .addColumn('logPath', 'text', (col) => col.notNull().defaultTo(config.defaultLogPath))
    .addColumn('screencastName', 'text', (col) => col)
    .addColumn('logName', 'text', (col) => col)
    .addColumn('entries', 'text', (col) => col)
    .addColumn('startedAt', 'integer', (col) => col)
    .addColumn('completedAt', 'integer', (col) => col)
    .addColumn('string', 'text', (col) => col)
    .addForeignKeyConstraint(
      'macros_JWT_fk', ['JWT'], 'session', ['JWT'],
      (cb) => cb.onDelete('cascade').onUpdate('cascade')
    )
    .execute()

  await db.schema
    .createTable('worker')
    .addColumn('id', 'integer', (col) => col.primaryKey())
    .addColumn('threadId', 'integer', (col) => col.notNull())
    .addColumn('status', 'varchar(10)', (col) => col.notNull())
    .addColumn('action', 'varchar(10)', (col) => col.notNull())
    .addColumn('message', 'text', (col) => col)
    .addColumn('macroId', 'integer', (col) => col)
    .addForeignKeyConstraint(
      'worker_macroId_fk', ['macroId'], 'macro', ['id']
    ).execute()
}

/**
 * Initialisiert eine Systemsitzung in der Datenbank für die Protokollierung
 * @returns {Promise<void>} Promise, das aufgelöst wird, wenn die Systemsitzung erstellt wurde
 * @description Erstellt einen Systemeintrag in der Sitzungstabelle für Systemprotokolle
 */
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

/**
 * Entfernt das Datenbankschema und alle Tabellen
 * @param {Kysely<any>} db - Kysely-Datenbankinstanz
 * @returns {Promise<void>} Promise, das aufgelöst wird, wenn das Schema entfernt wurde
 * @description Löscht alle Tabellen und bereinigt die Datenbankstruktur
 */
export async function down(db: Kysely<any>) {
  await db.schema.dropTable('session').execute()
  await db.schema.dropTable('protocol').execute()
  await db.schema.dropTable('macro').execute()
  await db.schema.dropTable('worker').execute()
}