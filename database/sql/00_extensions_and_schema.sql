-- CoDesk database bootstrap. Safe to re-run.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA IF NOT EXISTS co_desk;
COMMENT ON SCHEMA co_desk IS 'CoDesk office booking application objects';

SET search_path = co_desk, public;

