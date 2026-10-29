"""매일 동일한 데모 영업시간을 한국 표준시(UTC+9)로 계산한다."""

from datetime import datetime, time, timedelta, timezone

KST = timezone(timedelta(hours=9))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def store_response(row, now: datetime) -> dict:
    result = dict(row)
    opening = result.pop("opens_at")
    closing = result.pop("closes_at")
    result.update(hours=None, open_now=None, night=None)
    if opening is None or closing is None:
        return result
    start, end = time.fromisoformat(opening), time.fromisoformat(closing)
    current = now.astimezone(KST).time()
    overnight = start > end
    result["hours"] = f"{opening}–{closing}"
    result["open_now"] = (current >= start or current < end) if overnight else start <= current < end
    result["night"] = start != end and (overnight or end > time(21))
    return result
