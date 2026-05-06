#!/usr/bin/env python3
"""Bulk generate test events and push them to Kafka for Osprey processing.

Usage:
    python bulk_generate.py --count 1000 [--kafka-broker localhost:9092]

Also saves the generated input events to example_data/sample_actions.json.
"""

import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from typing import Any

WORDS = ['hello', 'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog', 'and', 'cat', 'runs', 'fast']
ACTION_NAMES = ['create_post', 'login']
EVENT_TYPES = ['create_post', 'login']


def generate_action(action_id: int, timestamp: datetime) -> dict[str, Any]:
    action_idx = random.randint(0, len(ACTION_NAMES) - 1)
    action_name = ACTION_NAMES[action_idx]
    event_type = EVENT_TYPES[action_idx]
    user_id = f'user_{random.randint(100, 9999)}'
    ip_address = f'192.168.{random.randint(0, 10)}.{random.randint(1, 254)}'
    text = ' '.join(random.choice(WORDS) for _ in range(5)) + '.'

    data: dict[str, Any] = {
        'user_id': user_id,
        'ip_address': ip_address,
        'event_type': event_type,
    }
    if action_name == 'create_post':
        data['post'] = {'text': text}

    return {
        'send_time': timestamp.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z',
        'data': {
            'action_id': action_id,
            'action_name': action_name,
            'data': data,
        },
    }


def main():
    parser = argparse.ArgumentParser(description='Bulk generate Osprey test events')
    parser.add_argument('--count', type=int, default=1000, help='Number of events to generate')
    parser.add_argument('--kafka-broker', default='localhost:9092', help='Kafka broker address')
    parser.add_argument('--topic', default='osprey.actions_input', help='Kafka topic')
    parser.add_argument('--spread-hours', type=int, default=24, help='Spread events over this many hours')
    args = parser.parse_args()

    # Generate events spread over the time window
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(hours=args.spread_hours)
    if args.count <= 0:
        parser.error('--count must be a positive integer')
    interval = timedelta(hours=args.spread_hours) / args.count

    events = []
    for i in range(args.count):
        ts = start_time + interval * i
        event = generate_action(action_id=10000 + i, timestamp=ts)
        events.append(event)

    # Save to JSON file
    import pathlib

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
