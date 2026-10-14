'use strict';

const fs = require('node:fs');
const mysql = require('./node_modules/mysql2/promise');

const EMAIL_PATTERN = '%@loadtest.invalid';
const DEFAULT_VERIFIED_RECORDS = 1000;

function readProperties(filePath) {
  const properties = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const separator = line.indexOf('=');
    if (separator > 0) properties[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return properties;
}

async function count(connection, sql) {
  const [rows] = await connection.execute(sql, [EMAIL_PATTERN]);
  return Number(rows[0].total);
}

async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    throw new Error(
      'Usage: node cleanup.js <application.properties> [expected-users [expected-portfolios]]',
    );
  }
  const expectedUsers = process.argv[3] === undefined
    ? DEFAULT_VERIFIED_RECORDS
    : Number(process.argv[3]);
  const expectedPortfolios = process.argv[4] === undefined
    ? expectedUsers
    : Number(process.argv[4]);
  if (!Number.isSafeInteger(expectedUsers) || expectedUsers < 1) {
    throw new Error('Expected user count must be a positive whole number.');
  }
  if (!Number.isSafeInteger(expectedPortfolios) || expectedPortfolios < 0) {
    throw new Error('Expected portfolio count must be a non-negative whole number.');
  }
  const properties = readProperties(configPath);
  const url = new URL(properties['spring.datasource.url'].replace(/^jdbc:/, ''));
  const database = decodeURIComponent(url.pathname.slice(1));
  if (database !== 'portfolio_db') {
    throw new Error(`Refusing cleanup: expected portfolio_db, got ${database}`);
  }

  const connection = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: properties['spring.datasource.username'],
    password: properties['spring.datasource.password'],
    database,
  });
  try {
    await connection.beginTransaction();
    const usersBefore = await count(connection,
      'SELECT COUNT(*) AS total FROM app_users WHERE email LIKE ?');
    const portfoliosBefore = await count(connection,
      `SELECT COUNT(*) AS total
       FROM portfolios p JOIN app_users u ON u.id = p.user_id
       WHERE u.email LIKE ?`);
    if (usersBefore !== expectedUsers || portfoliosBefore !== expectedPortfolios) {
      throw new Error(
        `Refusing cleanup: expected ${expectedUsers} verified test users and `
        + `${expectedPortfolios} owned portfolios, found ${usersBefore} and ${portfoliosBefore}`,
      );
    }

    const [holdings] = await connection.execute(
      `DELETE h FROM portfolio_holdings h
       JOIN portfolios p ON p.id = h.portfolio_id
       JOIN app_users u ON u.id = p.user_id
       WHERE u.email LIKE ?`,
      [EMAIL_PATTERN],
    );
    const [trades] = await connection.execute(
      `DELETE t FROM portfolio_trades t
       JOIN portfolios p ON p.id = t.portfolio_id
       JOIN app_users u ON u.id = p.user_id
       WHERE u.email LIKE ?`,
      [EMAIL_PATTERN],
    );
    const [portfolios] = await connection.execute(
      `DELETE p FROM portfolios p
       JOIN app_users u ON u.id = p.user_id
       WHERE u.email LIKE ?`,
      [EMAIL_PATTERN],
    );
    const [users] = await connection.execute(
      'DELETE FROM app_users WHERE email LIKE ?',
      [EMAIL_PATTERN],
    );
    const usersAfter = await count(connection,
      'SELECT COUNT(*) AS total FROM app_users WHERE email LIKE ?');
    const portfoliosAfter = await count(connection,
      `SELECT COUNT(*) AS total
       FROM portfolios p JOIN app_users u ON u.id = p.user_id
       WHERE u.email LIKE ?`);
    if (usersAfter !== 0 || portfoliosAfter !== 0
        || users.affectedRows !== expectedUsers
        || portfolios.affectedRows !== expectedPortfolios) {
      throw new Error('Cleanup verification failed; transaction rolled back');
    }

    await connection.commit();
    console.log(`Cleaned only @loadtest.invalid data from ${database}:`);
    console.log(`  users: ${users.affectedRows}`);
    console.log(`  owned portfolios: ${portfolios.affectedRows}`);
    console.log(`  portfolio holdings: ${holdings.affectedRows}`);
    console.log(`  portfolio trades: ${trades.affectedRows}`);
    console.log('  verified remaining load-test users/portfolios: 0 / 0');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Cleanup failed: ${error.message}`);
  process.exitCode = 1;
});
