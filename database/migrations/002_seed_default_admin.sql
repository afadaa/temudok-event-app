INSERT INTO admins (id, username, password, createdAt, updatedAt)
VALUES (
  'adminidikaltim2026',
  'adminidikaltim2026',
  '$2b$10$I1KX6blNyOCVMh8a2vKmqOHTT1t82U8hqiwpA38PGfzr.fLN5VAWS',
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  username = VALUES(username),
  password = VALUES(password),
  updatedAt = NOW();
