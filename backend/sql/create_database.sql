-- Run as PostgreSQL superuser or database admin.

CREATE USER softturn_user WITH PASSWORD 'softturn_password';
CREATE DATABASE softturn_db OWNER softturn_user;
GRANT ALL PRIVILEGES ON DATABASE softturn_db TO softturn_user;
