#!/usr/bin/env python3
"""Bulk generate realistic test events and push them to Kafka for Osprey processing.

Usage:
    python bulk_generate.py --count 1000 [--kafka-broker localhost:9092]

Also saves the generated input events to example_data/sample_actions.json.
"""

import argparse
import json
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
    # 70% posts, 30% logins (realistic ratio)
    is_post = random.random() < 0.7
    action_name = 'create_post' if is_post else 'login'
    user_id, ip_address = _get_user()

    data: dict[str, Any] = {
        'user_id': user_id,
        'ip_address': ip_address,
        'event_type': action_name,
    }

    if is_post:
        # ~15% of posts contain "hello" to trigger the T&S rule
        if random.random() < 0.15:
            text = _fill_template(random.choice(POST_TEMPLATES_HELLO))
        else:
            text = _fill_template(random.choice(POST_TEMPLATES_NORMAL))
        data['post'] = {'text': text}

    return {
        'send_time': timestamp.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z',
        'data': {
            'action_id': action_id,
            'action_name': action_name,
            'data': data,
        },
    }


def _add_traffic_spikes(base_count: int, spread_hours: int) -> list[float]:
    """Generate per-event weights to simulate realistic traffic patterns.

    Creates a diurnal pattern with peaks at 9am, 12pm, and 8pm UTC,
    plus random micro-bursts simulating viral moments.
    """
    weights: list[float] = []
    for i in range(base_count):
        hour_of_day = (i * spread_hours / base_count) % 24
        # Diurnal curve: low at night, peaks during day
        diurnal = 0.3 + 0.7 * max(
            0,
            1 - abs(hour_of_day - 12) / 8,  # broad daytime peak
        )
        # Add some randomness
        noise = random.uniform(0.7, 1.3)
        weights.append(diurnal * noise)
    return weights


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

    # Generate timestamps with realistic traffic distribution
    weights = _add_traffic_spikes(args.count, args.spread_hours)
    total_weight = sum(weights)
    cumulative = 0.0
    timestamps: list[datetime] = []
    for w in weights:
        frac = cumulative / total_weight
        timestamps.append(start_time + timedelta(hours=args.spread_hours) * frac)
        cumulative += w

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
