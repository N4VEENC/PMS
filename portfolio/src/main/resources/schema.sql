-- Bootstrap schema for the portfolio application (MySQL 8+).
-- Spring Batch metadata tables are initialized by Spring Batch separately.

CREATE DATABASE IF NOT EXISTS portfolio_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE portfolio_db;

CREATE TABLE IF NOT EXISTS gics_industries (
    industry_code CHAR(6) NOT NULL,
    sector_code CHAR(2) NOT NULL,
    sector_name VARCHAR(100) NOT NULL,
    industry_name VARCHAR(120) NOT NULL,
    PRIMARY KEY (industry_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    email VARCHAR(254) NOT NULL,
    username VARCHAR(80) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_app_users_email UNIQUE (email),
    CONSTRAINT uq_app_users_username UNIQUE (username)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS security_details (
    security_id BIGINT NOT NULL AUTO_INCREMENT,
    asset_type VARCHAR(20) NOT NULL,
    equity_category VARCHAR(30) NULL,
    isin VARCHAR(12) NULL,
    symbol VARCHAR(50) NULL,
    series VARCHAR(10) NULL,
    name VARCHAR(200) NOT NULL,
    description VARCHAR(500) NULL,
    exchange VARCHAR(30) NULL,
    currency VARCHAR(10) NULL,
    gics_industry_code CHAR(6) NULL,
    logo_url VARCHAR(500) NULL,
    website_url VARCHAR(500) NULL,
    country VARCHAR(100) NULL,
    market VARCHAR(100) NULL,
    risk_level VARCHAR(30) NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    PRIMARY KEY (security_id),
    CONSTRAINT uq_security_details_isin UNIQUE (isin),
    CONSTRAINT fk_security_details_gics_industry FOREIGN KEY (gics_industry_code)
        REFERENCES gics_industries (industry_code)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT ck_security_details_asset_type CHECK (
        asset_type IN ('EQUITY', 'MUTUAL', 'COMMODITY', 'BOND', 'CRYPTO', 'REIT', 'ETF', 'CASH')
    )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS investment_themes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    theme_code VARCHAR(40) NOT NULL,
    label VARCHAR(255) NOT NULL,
    risk VARCHAR(255) NOT NULL,
    investment_horizon VARCHAR(255) NOT NULL,
    description VARCHAR(1000) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_investment_themes_theme_code UNIQUE (theme_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS benchmark_indices (
    benchmark_id BIGINT NOT NULL AUTO_INCREMENT,
    index_code VARCHAR(30) NOT NULL,
    index_name VARCHAR(100) NOT NULL,
    symbol VARCHAR(50) NULL,
    exchange VARCHAR(50) NULL,
    country VARCHAR(50) NULL,
    currency VARCHAR(10) NULL,
    description VARCHAR(500) NULL,
    base_value DECIMAL(20,6) NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    PRIMARY KEY (benchmark_id),
    CONSTRAINT uq_benchmark_indices_index_code UNIQUE (index_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS portfolios (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL,
    currency VARCHAR(20) NOT NULL,
    benchmark VARCHAR(30) NOT NULL,
    exchange VARCHAR(10) NOT NULL,
    rebalance_frequency VARCHAR(20) NOT NULL,
    amount DECIMAL(20,2) NOT NULL,
    theme VARCHAR(40) NULL,
    purchase_date DATE NOT NULL,
    holdings_saved BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW',
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_portfolios_user_id (user_id),
    KEY idx_portfolios_theme (theme),
    CONSTRAINT ck_portfolios_amount_nonnegative CHECK (amount >= 0),
    CONSTRAINT fk_portfolios_user FOREIGN KEY (user_id)
        REFERENCES app_users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_portfolios_theme FOREIGN KEY (theme)
        REFERENCES investment_themes (theme_code)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS theme_allocations (
    id BIGINT NOT NULL AUTO_INCREMENT,
    theme_id BIGINT NOT NULL,
    asset_class VARCHAR(40) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_theme_allocations_theme_asset UNIQUE (theme_id, asset_class),
    CONSTRAINT ck_theme_allocations_percentage_range CHECK (percentage >= 0 AND percentage <= 100),
    CONSTRAINT fk_theme_allocations_theme FOREIGN KEY (theme_id)
        REFERENCES investment_themes (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS theme_equity_allocations (
    id BIGINT NOT NULL AUTO_INCREMENT,
    theme_id BIGINT NOT NULL,
    equity_category VARCHAR(30) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_theme_equity_allocations_theme_category UNIQUE (theme_id, equity_category),
    CONSTRAINT ck_theme_equity_allocations_percentage_range CHECK (percentage >= 0 AND percentage <= 100),
    CONSTRAINT fk_theme_equity_allocations_theme FOREIGN KEY (theme_id)
        REFERENCES investment_themes (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS portfolio_holdings (
    id BIGINT NOT NULL AUTO_INCREMENT,
    portfolio_id BIGINT NOT NULL,
    security_id BIGINT NOT NULL,
    isin VARCHAR(255) NULL,
    security_name VARCHAR(255) NULL,
    symbol VARCHAR(255) NULL,
    asset_class VARCHAR(40) NOT NULL,
    equity_category VARCHAR(30) NULL,
    shares DECIMAL(24,8) NOT NULL,
    price DECIMAL(20,6) NOT NULL,
    value DECIMAL(20,2) NOT NULL,
    price_date DATE NOT NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_portfolio_holdings_portfolio_security UNIQUE (portfolio_id, security_id),
    CONSTRAINT ck_portfolio_holdings_positive_values CHECK (shares > 0 AND price > 0 AND value >= 0),
    CONSTRAINT fk_portfolio_holdings_portfolio FOREIGN KEY (portfolio_id)
        REFERENCES portfolios (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_portfolio_holdings_security FOREIGN KEY (security_id)
        REFERENCES security_details (security_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS portfolio_trades (
    id BIGINT NOT NULL AUTO_INCREMENT,
    portfolio_id BIGINT NOT NULL,
    security_id BIGINT NOT NULL,
    isin VARCHAR(255) NULL,
    symbol VARCHAR(255) NULL,
    security_name VARCHAR(255) NULL,
    asset_class VARCHAR(40) NOT NULL,
    equity_category VARCHAR(30) NULL,
    signed_shares DECIMAL(24,8) NOT NULL,
    unit_price DECIMAL(20,6) NOT NULL,
    trade_date DATE NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_portfolio_trade_date (portfolio_id, trade_date),
    CONSTRAINT ck_portfolio_trades_valid_values CHECK (signed_shares <> 0 AND unit_price > 0),
    CONSTRAINT fk_portfolio_trades_portfolio FOREIGN KEY (portfolio_id)
        REFERENCES portfolios (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_portfolio_trades_security FOREIGN KEY (security_id)
        REFERENCES security_details (security_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS daily_prices (
    id BIGINT NOT NULL AUTO_INCREMENT,
    security_id BIGINT NOT NULL,
    trade_date DATE NOT NULL,
    open_price DECIMAL(20,6) NULL,
    high_price DECIMAL(20,6) NULL,
    low_price DECIMAL(20,6) NULL,
    close_price DECIMAL(20,6) NULL,
    prev_close DECIMAL(20,6) NULL,
    last_price DECIMAL(20,6) NULL,
    volume BIGINT NULL,
    nav DECIMAL(20,6) NULL,
    spot_price DECIMAL(20,6) NULL,
    valuation_price DECIMAL(20,6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_daily_price_security_date UNIQUE (security_id, trade_date),
    CONSTRAINT ck_daily_prices_valid_values CHECK (
        ((valuation_price IS NOT NULL AND valuation_price > 0)
            OR (close_price IS NOT NULL AND close_price > 0)
            OR (nav IS NOT NULL AND nav > 0)
            OR (spot_price IS NOT NULL AND spot_price > 0)
            OR (last_price IS NOT NULL AND last_price > 0))
        AND (open_price IS NULL OR open_price > 0)
        AND (high_price IS NULL OR high_price > 0)
        AND (low_price IS NULL OR low_price > 0)
        AND (prev_close IS NULL OR prev_close > 0)
        AND (last_price IS NULL OR last_price > 0)
        AND (close_price IS NULL OR close_price > 0)
        AND (nav IS NULL OR nav > 0)
        AND (spot_price IS NULL OR spot_price > 0)
        AND (valuation_price IS NULL OR valuation_price > 0)
        AND (volume IS NULL OR volume >= 0)
        AND (high_price IS NULL OR low_price IS NULL OR high_price >= low_price)
    ),
    CONSTRAINT fk_daily_prices_security FOREIGN KEY (security_id)
        REFERENCES security_details (security_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bond_details (
    security_id BIGINT NOT NULL,
    issuer VARCHAR(200) NULL,
    issuer_type VARCHAR(50) NULL,
    bond_name VARCHAR(200) NULL,
    bond_type VARCHAR(50) NULL,
    face_value DECIMAL(20,6) NULL,
    issue_price DECIMAL(20,6) NULL,
    coupon_rate DECIMAL(10,6) NULL,
    coupon_type VARCHAR(30) NULL,
    coupon_frequency VARCHAR(30) NULL,
    issue_date DATE NULL,
    maturity_date DATE NULL,
    yield_to_maturity DECIMAL(10,6) NULL,
    credit_rating VARCHAR(20) NULL,
    rating_agency VARCHAR(100) NULL,
    callable BOOLEAN NULL,
    puttable BOOLEAN NULL,
    minimum_investment DECIMAL(20,6) NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    PRIMARY KEY (security_id),
    CONSTRAINT fk_bond_details_security FOREIGN KEY (security_id)
        REFERENCES security_details (security_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS benchmark_daily_prices (
    id BIGINT NOT NULL AUTO_INCREMENT,
    benchmark_id BIGINT NOT NULL,
    trade_date DATE NOT NULL,
    open_value DECIMAL(20,6) NULL,
    high_value DECIMAL(20,6) NULL,
    low_value DECIMAL(20,6) NULL,
    close_value DECIMAL(20,6) NULL,
    prev_close DECIMAL(20,6) NULL,
    change_value DECIMAL(20,6) NULL,
    change_percent DECIMAL(12,6) NULL,
    volume BIGINT NULL,
    created_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_benchmark_daily_price_date UNIQUE (benchmark_id, trade_date),
    CONSTRAINT fk_benchmark_daily_prices_index FOREIGN KEY (benchmark_id)
        REFERENCES benchmark_indices (benchmark_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;
