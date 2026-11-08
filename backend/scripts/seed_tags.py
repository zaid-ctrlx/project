"""Seed a starter set of interest tags. Safe to re-run — skips tags that
already exist (matched by slug). Run from backend/ with the venv active:

    python -m scripts.seed_tags
"""
from sqlalchemy.dialects.postgresql import insert

from app.db.session import SessionLocal
from app.models.user import Tag
from app.recsys.taxonomy import TAG_NAMES

# One tag per slug in the recommender's vocabulary (app/recsys/taxonomy.py), so
# every event activity type has a matching interest tag users can pick.
STARTER_TAGS = [(name, slug) for slug, name in TAG_NAMES.items()]


def seed_tags() -> None:
    db = SessionLocal()
    try:
        stmt = insert(Tag).values(
            [{"name": name, "slug": slug} for name, slug in STARTER_TAGS]
        )
        stmt = stmt.on_conflict_do_nothing(index_elements=["slug"])
        db.execute(stmt)
        db.commit()
        # psycopg doesn't reliably report rowcount for INSERT ... ON CONFLICT,
        # so just confirm the end state instead of trying to report a delta.
        total = db.query(Tag).count()
        print(f"Done. {total} tag(s) now in the database.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_tags()
