from .base import *  # noqa: F403

DEBUG = True

if not os.environ.get("DATABASE_URL"):
    DATABASES = {"default": dj_database_url.parse("postgres://postgres:postgres@localhost:5432/novex_bd", conn_max_age=60)}
