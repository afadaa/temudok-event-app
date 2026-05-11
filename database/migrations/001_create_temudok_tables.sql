CREATE TABLE IF NOT EXISTS admins (
  id VARCHAR(191) PRIMARY KEY,
  username VARCHAR(191) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  createdAt DATETIME NULL,
  updatedAt DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS branches (
  id VARCHAR(191) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  createdAt DATETIME NULL,
  updatedAt DATETIME NULL,
  INDEX idx_branches_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(191) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price INT NOT NULL DEFAULT 0,
  createdAt DATETIME NULL,
  updatedAt DATETIME NULL,
  INDEX idx_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(191) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  startDate DATETIME NULL,
  endDate DATETIME NULL,
  location VARCHAR(255) NULL,
  address TEXT NULL,
  isActive TINYINT(1) NOT NULL DEFAULT 1,
  categories JSON NULL,
  createdAt DATETIME NULL,
  updatedAt DATETIME NULL,
  INDEX idx_events_active_start (isActive, startDate),
  INDEX idx_events_created (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS registrations (
  id VARCHAR(191) PRIMARY KEY,
  orderId VARCHAR(191) NOT NULL UNIQUE,
  eventId VARCHAR(191) NOT NULL,
  eventTitle VARCHAR(255) NULL,
  fullName VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  npa VARCHAR(100) NULL,
  category VARCHAR(255) NOT NULL,
  categoryId VARCHAR(191) NOT NULL,
  branchId VARCHAR(191) NULL,
  kriteria VARCHAR(255) NULL,
  tipePeserta VARCHAR(255) NULL,
  suratMandatUrl TEXT NULL,
  komisi VARCHAR(255) NULL,
  perhimpunanName VARCHAR(255) NULL,
  mkekBranch VARCHAR(255) NULL,
  bersedia TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  amount INT NOT NULL DEFAULT 0,
  paymentVerified TINYINT(1) NOT NULL DEFAULT 0,
  paymentPhoto LONGTEXT NULL,
  paymentPhotoFile TEXT NULL,
  photoUrl LONGTEXT NULL,
  checkedIn TINYINT(1) NOT NULL DEFAULT 0,
  checkedInAt DATETIME NULL,
  createdAt DATETIME NULL,
  updatedAt DATETIME NULL,
  INDEX idx_registrations_email_event (email, eventId),
  INDEX idx_registrations_email (email),
  INDEX idx_registrations_status (status),
  INDEX idx_registrations_created (createdAt),
  INDEX idx_registrations_checked_in (checkedIn, checkedInAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
