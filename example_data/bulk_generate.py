#!/usr/bin/env python3
"""Bulk generate realistic test events and push them to Kafka for Osprey processing.

Usage:
    python bulk_generate.py --count 1000 [--kafka-broker localhost:9092]

Also saves the generated input events to example_data/sample_actions.json.
"""

import argparse
import json
import math
import pathlib
import random
from datetime import datetime, timedelta, timezone
from typing import Any

# --- Realistic data pools ---

FIRST_NAMES = [
    'emma',
    'liam',
    'olivia',
    'noah',
    'ava',
    'ethan',
    'sophia',
    'mason',
    'isabella',
    'james',
    'mia',
    'benjamin',
    'charlotte',
    'jacob',
    'amelia',
    'michael',
    'harper',
    'alexander',
    'evelyn',
    'daniel',
    'abigail',
    'lucas',
    'emily',
    'henry',
    'elizabeth',
    'sebastian',
    'sofia',
    'jack',
    'avery',
    'owen',
    'ella',
    'ryan',
    'scarlett',
    'nathan',
    'grace',
    'caleb',
    'chloe',
    'tyler',
    'victoria',
    'dylan',
    'riley',
    'luke',
    'aria',
    'andrew',
    'lily',
    'isaac',
    'zoey',
    'gabriel',
    'penelope',
    'anthony',
    'hannah',
    'samuel',
    'nora',
    'david',
    'addison',
    'joseph',
    'stella',
    'leo',
    'savannah',
    'adam',
]

LAST_NAMES = [
    'smith',
    'johnson',
    'williams',
    'brown',
    'jones',
    'garcia',
    'miller',
    'davis',
    'rodriguez',
    'martinez',
    'hernandez',
    'lopez',
    'gonzalez',
    'wilson',
    'anderson',
    'thomas',
    'taylor',
    'moore',
    'jackson',
    'martin',
    'lee',
    'perez',
    'thompson',
    'white',
    'harris',
    'sanchez',
    'clark',
    'ramirez',
    'lewis',
    'robinson',
    'walker',
    'young',
    'allen',
    'king',
    'wright',
    'scott',
    'torres',
    'nguyen',
    'hill',
    'flores',
    'green',
    'adams',
    'nelson',
    'baker',
    'hall',
    'rivera',
    'campbell',
    'mitchell',
    'chen',
    'kim',
    'patel',
    'shah',
    'kumar',
    'singh',
    'park',
    'li',
    'wang',
]

# Realistic social media post templates
POST_TEMPLATES_NORMAL = [
    'Just finished reading {book}. Absolutely loved it!',
    'Anyone else watching {show}? The latest episode was incredible',
    'Beautiful sunset today from {location}. Nature never disappoints 🌅',
    'Finally got my {item} delivered! So excited to try it out',
    'Had an amazing dinner at {restaurant}. The {food} was perfect',
    "Working from {location} today. Can't beat this view",
    'Happy birthday to my best friend @{mention}! Love you! 🎂',
    'New personal record at the gym today! {exercise} is paying off',
    'Just adopted a {pet} from the shelter. Meet {pet_name}! 🐾',
    'Started learning {skill} this week. Any tips from the community?',
    'Road trip to {location} this weekend. Any recommendations?',
    'Made {food} from scratch today. Turned out better than expected!',
    'Great meetup tonight with the {topic} community. Learned so much',
    'Anyone know a good {service} in {location}? Moving there next month',
    'Can we talk about how good {show} season {number} is?',
    'Three years at {company} today. Grateful for this team 💪',
    'Morning coffee and {activity}. Best way to start the day',
    'Finally finished my {project}. Months of work but worth it',
    'Throwback to our trip to {location} last summer. Miss it already',
    'Quick review: {product} is {rating}/10. Totally worth the price',
    'Study group for {subject} exam next week? DM me if interested',
    'Loving the new {feature} update on {app}. Great improvement',
    'Rainy day vibes. Perfect weather for {activity} and hot chocolate',
    'Volunteered at {organization} today. Such a rewarding experience',
    'Date night at {restaurant}. {number} years and still going strong ❤️',
    "Big news: I'm officially starting my {business} business!",
    'Check out this {art_type} I made over the weekend',
    'Flight delayed again at {airport}. Third time this month 😤',
    'Passed my {certification} exam! Hard work pays off 🎉',
    'Unpopular opinion: {food} is overrated. Fight me in the comments',
]

# Posts that trigger the "hello" rule (T&S violation simulation)
POST_TEMPLATES_HELLO = [
    'hello everyone! New to this platform, excited to connect!',
    'hello world! Testing my first post here',
    'Just want to say hello to all my new followers!',
    'hello from {location}! Having an amazing time here',
    'hello friends! Who wants to join our weekend {activity}?',
    'A big hello to the {topic} community! Glad to be here',
    'hello! Quick question about {topic} - can anyone help?',
    'Saying hello after a long break. Missed this community!',
    'hello team! Excited to announce our {event} next month',
    'hello {location}! Just moved here and looking for recommendations',
]

BOOKS = [
    'Project Hail Mary',
    'The Midnight Library',
    'Atomic Habits',
    'Dune',
    'The Thursday Murder Club',
    'Circe',
    'Educated',
    'The Silent Patient',
    'Where the Crawdads Sing',
    'Becoming',
    'Sapiens',
    'The Alchemist',
]

SHOWS = [
    'The Last of Us',
    'Succession',
    'Wednesday',
    'The Bear',
    'House of the Dragon',
    'Severance',
    'Yellowjackets',
    'Beef',
    'The White Lotus',
    'Only Murders in the Building',
    'Shogun',
]

LOCATIONS = [
    'San Francisco',
    'Brooklyn',
    'Austin',
    'Portland',
    'Denver',
    'Chicago',
    'Seattle',
    'Nashville',
    'Miami',
    'Boston',
    'Lisbon',
    'Barcelona',
    'Tokyo',
    'London',
    'Paris',
    'Amsterdam',
    'Bali',
    'Vancouver',
    'Berlin',
    'Dublin',
    'Melbourne',
    'Singapore',
]

FOODS = [
    'pasta carbonara',
    'sushi platter',
    'tacos al pastor',
    'pad thai',
    'margherita pizza',
    'pho',
    'biryani',
    'fish and chips',
    'ramen',
    'grilled salmon',
    'avocado toast',
    'burritos',
    'dumplings',
]

RESTAURANTS = [
    'Sakura Sushi',
    'The Copper Pot',
    'Bella Napoli',
    'Chez Marie',
    'Golden Dragon',
    'The Rustic Table',
    'Spice Route',
    'Blue Harbor',
    'La Cocina',
    'The Local Kitchen',
    'Harbor House',
    'Verde Garden',
]

ITEMS = [
    'PS5',
    'AirPods Pro',
    'Kindle Paperwhite',
    'mechanical keyboard',
    'standing desk',
    'espresso machine',
    'noise-canceling headphones',
    'new laptop',
    'vinyl record player',
    'Instant Pot',
    'camera lens',
]

SKILLS = [
    'Python',
    'guitar',
    'Spanish',
    'watercolor painting',
    'photography',
    'woodworking',
    'machine learning',
    'pottery',
    'rock climbing',
    'baking sourdough',
    'chess',
    'Rust programming',
    'yoga',
]

COMPANIES = [
    'Acme Corp',
    'TechFlow',
    'DataWave',
    'CloudNine',
    'GreenLeaf',
    'NovaTech',
    'PulseMedia',
    'UrbanGrid',
    'SkyBridge',
    'CoreLogic',
]

PETS = ['dog', 'cat', 'rabbit', 'kitten', 'puppy']
PET_NAMES = ['Luna', 'Milo', 'Buddy', 'Daisy', 'Charlie', 'Bella', 'Max', 'Coco', 'Rocky', 'Sadie']
EXERCISES = ['Deadlift progression', 'Running 5K', 'Swimming', 'Cycling', 'Yoga practice']
TOPICS = ['React', 'data science', 'gardening', 'photography', 'cooking', 'gaming', 'fitness']
ACTIVITIES = ['reading', 'coding', 'sketching', 'journaling', 'puzzle-solving', 'binge-watching']
AIRPORTS = ['JFK', 'LAX', 'ORD', 'SFO', 'ATL', 'DFW', 'DEN', 'SEA', 'MIA', 'BOS']
CERTIFICATIONS = ['AWS Solutions Architect', 'PMP', 'CKA', 'CISSP', 'Google Cloud Professional']
APPS = ['Spotify', 'Notion', 'Figma', 'Discord', 'Slack', 'VS Code', 'Chrome']

# Realistic IP ranges (mix of residential, corporate, mobile, cloud)
IP_PREFIXES = [
    # US residential ISPs
    ('24.', 1, 254),
    ('68.', 1, 254),
    ('71.', 1, 254),
    ('76.', 1, 254),
    ('98.', 1, 254),
    ('107.', 1, 254),
    ('108.', 1, 254),
    ('174.', 1, 254),
    # European ISPs
    ('82.', 1, 254),
    ('86.', 1, 254),
    ('90.', 1, 254),
    ('109.', 1, 254),
    # Mobile carriers
    ('172.56.', 1, 254),
    ('100.', 1, 254),
    # Cloud/VPN (suspicious traffic pattern)
    ('34.', 1, 254),
    ('35.', 1, 254),
    ('52.', 1, 254),
    ('54.', 1, 254),
]


def _generate_username() -> str:
    """Generate a realistic username like 'emma.smith42' or 'liam_j'."""
    style = random.randint(0, 4)
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    if style == 0:
        return f'{first}.{last}{random.randint(1, 99)}'
    elif style == 1:
        return f'{first}_{last[0]}{random.randint(10, 999)}'
    elif style == 2:
        return f'{first}{last}{random.randint(1, 9999)}'
    elif style == 3:
        return f'{first[0]}{last}{random.randint(10, 99)}'
    else:
        return f'{first}_{random.randint(100, 9999)}'


def _generate_ip() -> str:
    """Generate a realistic IP address."""
    prefix, lo, hi = random.choice(IP_PREFIXES)
    octets_needed = 4 - prefix.count('.')
    parts = [str(random.randint(lo, hi)) for _ in range(octets_needed)]
    return prefix + '.'.join(parts)


def _fill_template(template: str) -> str:
    """Fill a post template with realistic values."""
    replacements: dict[str, str] = {
        '{book}': random.choice(BOOKS),
        '{show}': random.choice(SHOWS),
        '{location}': random.choice(LOCATIONS),
        '{item}': random.choice(ITEMS),
        '{restaurant}': random.choice(RESTAURANTS),
        '{food}': random.choice(FOODS),
        '{mention}': _generate_username(),
        '{exercise}': random.choice(EXERCISES),
        '{pet}': random.choice(PETS),
        '{pet_name}': random.choice(PET_NAMES),
        '{skill}': random.choice(SKILLS),
        '{service}': random.choice(['plumber', 'dentist', 'mechanic', 'barber', 'vet']),
        '{number}': str(random.randint(2, 12)),
        '{company}': random.choice(COMPANIES),
        '{activity}': random.choice(ACTIVITIES),
        '{project}': random.choice(['portfolio website', 'mobile app', 'documentary', 'novel', 'art series']),
        '{product}': random.choice(ITEMS),
        '{rating}': str(random.randint(6, 10)),
        '{subject}': random.choice(['organic chemistry', 'linear algebra', 'microeconomics', 'data structures']),
        '{feature}': random.choice(['dark mode', 'AI assistant', 'collaboration', 'search']),
        '{app}': random.choice(APPS),
        '{organization}': random.choice(
            ['Habitat for Humanity', 'local food bank', 'animal shelter', 'Boys & Girls Club']
        ),
        '{business}': random.choice(['photography', 'consulting', 'bakery', 'tutoring', 'design']),
        '{art_type}': random.choice(['painting', 'sculpture', 'digital art', 'pottery piece', 'sketch']),
        '{airport}': random.choice(AIRPORTS),
        '{certification}': random.choice(CERTIFICATIONS),
        '{topic}': random.choice(TOPICS),
        '{event}': random.choice(['hackathon', 'meetup', 'workshop', 'conference', 'webinar']),
    }
    result = template
    for key, value in replacements.items():
        result = result.replace(key, value)
    return result


# Persistent user pool to simulate repeat users
_USER_POOL: list[tuple[str, str]] = []


def _get_user() -> tuple[str, str]:
    """Return a (user_id, ip_address) pair, reusing users ~60% of the time."""
    if _USER_POOL and random.random() < 0.6:
        user_id, base_ip = random.choice(_USER_POOL)
        # Same user might have slightly different IP (mobile, VPN switch)
        if random.random() < 0.8:
            return user_id, base_ip
        return user_id, _generate_ip()

    user_id = _generate_username()
    ip = _generate_ip()
    _USER_POOL.append((user_id, ip))
    if len(_USER_POOL) > 500:
        _USER_POOL.pop(0)
    return user_id, ip


def generate_action(action_id: int, timestamp: datetime) -> dict[str, Any]:
    """Generate a single realistic action event."""
    hour = timestamp.hour

    # Login ratio varies by time: higher in morning (people signing in), lower at night
    if hour < 6:
        login_chance = 0.15
    elif hour < 10:
        login_chance = 0.45  # morning login surge
    elif hour < 14:
        login_chance = 0.25
    else:
        login_chance = 0.20

    is_post = random.random() >= login_chance
    action_name = 'create_post' if is_post else 'login'
    user_id, ip_address = _get_user()

    data: dict[str, Any] = {
        'user_id': user_id,
        'ip_address': ip_address,
        'event_type': action_name,
    }

    if is_post:
        # Hello rate: higher for new-ish accounts, varies 5-20%
        hello_rate = 0.10 + 0.10 * (hash(user_id) % 100) / 100
        trending = _pick_trending_context()

        if random.random() < hello_rate:
            template = random.choice(POST_TEMPLATES_HELLO)
        else:
            # If there's a trending topic, bias toward templates that use it
            if trending.get('_trending') == 'location':
                location_templates = [t for t in POST_TEMPLATES_NORMAL if '{location}' in t]
                template = random.choice(location_templates or POST_TEMPLATES_NORMAL)
            elif trending.get('_trending') == 'show':
                show_templates = [t for t in POST_TEMPLATES_NORMAL if '{show}' in t]
                template = random.choice(show_templates or POST_TEMPLATES_NORMAL)
            else:
                template = random.choice(POST_TEMPLATES_NORMAL)

        text = _fill_template(template)
        data['post'] = {'text': text}

    return {
        'send_time': timestamp.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z',
        'data': {
            'action_id': action_id,
            'action_name': action_name,
            'data': data,
        },
    }


def _generate_timestamps(count: int, spread_hours: int, start_time: datetime) -> list[datetime]:
    """Generate timestamps with realistic, bursty human-like traffic patterns.

    Models multiple overlapping effects:
    - Diurnal cycle with asymmetric rise/fall (fast morning ramp, slow evening decay)
    - Random viral spikes (3-8 per day, each lasting 5-30 minutes)
    - Dead zones (2am-5am near zero traffic)
    - Per-event jitter (Poisson-like inter-arrival times within each hour)
    - Weekend vs weekday variation if spread > 24h
    """
    # Step 1: Build a per-minute rate curve (not per-event — decouples count from shape)
    total_minutes = spread_hours * 60
    rates: list[float] = []

    # Pre-compute 3-8 viral spike windows
    num_spikes = random.randint(3, 8)
    spikes: list[tuple[float, float, float]] = []  # (center_min, half_width_min, intensity)
    for _ in range(num_spikes):
        center = random.uniform(0, total_minutes)
        half_width = random.uniform(2.5, 15.0)  # 5-30 min spikes
        intensity = random.uniform(2.0, 8.0)
        spikes.append((center, half_width, intensity))

    for m in range(total_minutes):
        abs_time = start_time + timedelta(minutes=m)
        hour_of_day = abs_time.hour + abs_time.minute / 60.0
        day_of_week = abs_time.weekday()  # 0=Mon, 6=Sun

        # Diurnal: asymmetric with fast morning ramp, broad afternoon plateau, slow decay
        if hour_of_day < 3:
            diurnal = 0.02 + 0.03 * hour_of_day / 3  # near-dead: 2-5%
        elif hour_of_day < 6:
            diurnal = 0.05 + 0.15 * (hour_of_day - 3) / 3  # slow wake-up: 5-20%
        elif hour_of_day < 9:
            diurnal = 0.20 + 0.60 * (hour_of_day - 6) / 3  # morning ramp: 20-80%
        elif hour_of_day < 13:
            diurnal = 0.80 + 0.20 * math.sin((hour_of_day - 9) / 4 * math.pi)  # plateau: 80-100%
        elif hour_of_day < 15:
            diurnal = 0.85 + 0.10 * random.random()  # post-lunch dip recovery
        elif hour_of_day < 21:
            diurnal = 0.95 - 0.35 * (hour_of_day - 15) / 6  # slow evening decay: 95-60%
        elif hour_of_day < 23:
            diurnal = 0.60 - 0.40 * (hour_of_day - 21) / 2  # night dropoff: 60-20%
        else:
            diurnal = 0.20 - 0.15 * (hour_of_day - 23)  # late night: 20-5%

        # Weekend modifier: ~30% less traffic on weekends, shifted later
        if day_of_week >= 5:
            diurnal *= 0.7
            # Weekend peaks shift ~2h later
            if 8 < hour_of_day < 12:
                diurnal *= 0.6  # slower weekend mornings

        # Add viral spikes (Gaussian bumps)
        spike_boost = 0.0
        for center, half_width, intensity in spikes:
            dist = abs(m - center)
            if dist < half_width * 3:  # only compute near the spike
                spike_boost += intensity * math.exp(-0.5 * (dist / half_width) ** 2)

        # Per-minute noise: multiplicative log-normal-ish jitter
        noise = math.exp(random.gauss(0, 0.4))

        rate = max(0.001, diurnal * noise + spike_boost * random.uniform(0.5, 1.5))
        rates.append(rate)

    # Step 2: Sample `count` timestamps proportional to the rate curve
    total_rate = sum(rates)
    timestamps: list[datetime] = []
    for m, rate in enumerate(rates):
        # Expected events in this minute
        expected = count * rate / total_rate
        # Poisson sampling: actual events this minute
        n_events = _poisson_sample(expected)
        for _ in range(n_events):
            # Uniform jitter within the minute
            offset_sec = m * 60 + random.uniform(0, 60)
            timestamps.append(start_time + timedelta(seconds=offset_sec))

    # Trim or pad to exact count
    random.shuffle(timestamps)
    if len(timestamps) > count:
        timestamps = timestamps[:count]
    while len(timestamps) < count:
        # Fill gaps by sampling from the rate distribution
        m = random.choices(range(total_minutes), weights=rates, k=1)[0]
        offset_sec = m * 60 + random.uniform(0, 60)
        timestamps.append(start_time + timedelta(seconds=offset_sec))

    timestamps.sort()
    return timestamps


def _poisson_sample(lam: float) -> int:
    """Sample from Poisson distribution using inverse transform."""
    if lam <= 0:
        return 0
    if lam > 30:
        # For large lambda, use normal approximation
        return max(0, int(random.gauss(lam, math.sqrt(lam)) + 0.5))
    l_val = math.exp(-lam)
    k = 0
    p = 1.0
    while True:
        k += 1
        p *= random.random()
        if p < l_val:
            return k - 1


# --- Trending topic / location clustering ---

_CURRENT_TRENDING: dict[str, Any] = {}


def _pick_trending_context() -> dict[str, str]:
    """Occasionally cluster posts around a trending topic or location."""
    global _CURRENT_TRENDING  # noqa: PLW0603
    # 20% chance a post is part of a trending cluster
    if random.random() < 0.2 and _CURRENT_TRENDING:
        return dict(_CURRENT_TRENDING)
    # 3% chance to start a new trend
    if random.random() < 0.03:
        trend_type = random.choice(['location', 'show', 'topic'])
        if trend_type == 'location':
            loc = random.choice(LOCATIONS)
            _CURRENT_TRENDING = {'_trending': 'location', 'location': loc}
        elif trend_type == 'show':
            show = random.choice(SHOWS)
            _CURRENT_TRENDING = {'_trending': 'show', 'show': show}
        else:
            topic = random.choice(TOPICS)
            _CURRENT_TRENDING = {'_trending': 'topic', 'topic': topic}
        return dict(_CURRENT_TRENDING)
    # 5% chance to end current trend
    if random.random() < 0.05:
        _CURRENT_TRENDING = {}
    return {}


def main() -> None:
    parser = argparse.ArgumentParser(description='Bulk generate realistic Osprey test events')
    parser.add_argument('--count', type=int, default=1000, help='Number of events to generate')
    parser.add_argument('--kafka-broker', default='localhost:9092', help='Kafka broker address')
    parser.add_argument('--topic', default='osprey.actions_input', help='Kafka topic')
    parser.add_argument('--spread-hours', type=int, default=24, help='Spread events over this many hours')
    parser.add_argument('--seed', type=int, default=42, help='Random seed for reproducibility')
    args = parser.parse_args()

    if args.count <= 0:
        parser.error('--count must be a positive integer')

    random.seed(args.seed)

    now = datetime.now(timezone.utc)
    start_time = now - timedelta(hours=args.spread_hours)

    timestamps = _generate_timestamps(args.count, args.spread_hours, start_time)

    events = []
    for i, ts in enumerate(timestamps):
        event = generate_action(action_id=10000 + i, timestamp=ts)
        events.append(event)

    out_path = pathlib.Path(__file__).parent / 'sample_actions.json'
    with open(out_path, 'w') as f:
        json.dump(events, f, indent=2)
    print(f'Saved {len(events)} input events to {out_path}')

    # Push to Kafka
    try:
        from kafka import KafkaProducer

        producer = KafkaProducer(
            bootstrap_servers=args.kafka_broker,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
        )
        sent = 0
        for event in events:
            producer.send(args.topic, value=event)
            sent += 1
            if sent % 100 == 0:
                print(f'  Sent {sent}/{len(events)} events to Kafka...')
        producer.flush()
        producer.close()
        print(f"Successfully sent {sent} events to Kafka topic '{args.topic}'")
    except Exception as e:
        print(f'Failed to send to Kafka: {e}')
        print('Events are still saved to the JSON file.')


if __name__ == '__main__':
    main()
