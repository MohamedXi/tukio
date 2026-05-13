-- Tukio — Postgres init script (Story 0.10)
-- Runs once at first container init (Postgres entrypoint: /docker-entrypoint-initdb.d/).
-- Creates the Keycloak DB + the 10 Tukio service DBs so dependent services
-- (Keycloak especially) can boot without waiting for `bootstrap-databases.sh`.
--
-- All databases are owned by the default POSTGRES_USER ("tukio"). Re-running
-- bootstrap-databases.sh remains idempotent.

CREATE DATABASE keycloak;
CREATE DATABASE tukio_identity;
CREATE DATABASE tukio_catalog;
CREATE DATABASE tukio_booking;
CREATE DATABASE tukio_order;
CREATE DATABASE tukio_payment;
CREATE DATABASE tukio_messaging;
CREATE DATABASE tukio_review;
CREATE DATABASE tukio_notification;
CREATE DATABASE tukio_media;
-- tukio_meta is POSTGRES_DB, already created by the entrypoint.
