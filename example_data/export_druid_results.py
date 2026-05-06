#!/usr/bin/env python3
"""Export all execution results from Druid to a JSON file.

Usage:
    python export_druid_results.py [--druid-url http://localhost:8082] [--output example_data/sample_execution_results.json]
"""

import argparse
import json
import urllib.request
from typing import Any


def query_druid(druid_url: str, sql: str) -> list[dict[str, Any]]:
    data = json.dumps({'query': sql}).encode('utf-8')
    req = urllib.request.Request(
        f'{druid_url}/druid/v2/sql',
        data=data,
        headers={'Content-Type': 'application/json'},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))


def main():
    parser = argparse.ArgumentParser(description='Export Druid execution results')
    parser.add_argument('--druid-url', default='http://localhost:8082')
    parser.add_argument('--output', default='example_data/sample_execution_results.json')
    args = parser.parse_args()

    # Get total count
    count_result = query_druid(args.druid_url, 'SELECT COUNT(*) AS cnt FROM "osprey.execution_results"')
    total = count_result[0]['cnt']
    print(f'Total records in Druid: {total}')

    # Export all records
    all_results = []
    page_size = 500
    offset = 0
    while offset < total:
        sql = f'SELECT * FROM "osprey.execution_results" ORDER BY "__time" ASC LIMIT {page_size} OFFSET {offset}'
        page = query_druid(args.druid_url, sql)
        all_results.extend(page)
        offset += page_size
        print(f'  Exported {min(offset, total)}/{total} records...')

    with open(args.output, 'w') as f:
        json.dump(all_results, f, indent=2)
    print(f'Saved {len(all_results)} execution results to {args.output}')


if __name__ == '__main__':
    main()
