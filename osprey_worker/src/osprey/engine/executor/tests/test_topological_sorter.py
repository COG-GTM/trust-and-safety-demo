import random
from typing import Any, List, Tuple

import pytest
from osprey.engine.executor.topological_sorter import TopologicalSorter


class _FullScanTopologicalSorter(TopologicalSorter):
    """Reference implementation: rebuilds the ready list by scanning every node on each prepare()."""

    def prepare(self) -> None:
        if not self._needs_prepare:
            return
        self._ready_nodes = [i.node for i in self._node2info.values() if i.npredecessors == 0]
        self._added_since_prepare = []
        self._needs_prepare = False


def _run_dynamic(sorter: TopologicalSorter, seed: int) -> List[Tuple[Any, ...]]:
    """Mimics ExecutionContext: nodes are added in batches while execution is in progress (Require/Import),
    with prepare() after each batch and done() called in a shuffled order."""
    rng = random.Random(seed)
    next_node = 0
    added: List[int] = []
    batches: List[Tuple[Any, ...]] = []

    def add_batch() -> None:
        nonlocal next_node
        for _ in range(rng.randint(1, 8)):
            preds = rng.sample(added, k=min(len(added), rng.randint(0, 3)))
            if rng.random() < 0.2:
                # A predecessor that has not been added yet gets created implicitly.
                preds.append(f'implicit-{next_node}')
            sorter.add(next_node, *preds)
            added.append(next_node)
            next_node += 1
        sorter.prepare()

    add_batch()
    in_progress: List[Any] = []
    while sorter.is_active():
        ready = sorter.get_ready()
        batches.append(ready)
        in_progress.extend(ready)
        rng.shuffle(in_progress)
        finished, in_progress = in_progress[: rng.randint(0, len(in_progress))], in_progress
        in_progress = [n for n in in_progress if n not in finished]
        if finished:
            sorter.done(*finished)
        if next_node < 60 and rng.random() < 0.5:
            add_batch()
        elif not finished and not ready and in_progress:
            sorter.done(in_progress.pop())
    return batches


@pytest.mark.parametrize('seed', range(50))
def test_incremental_prepare_matches_full_scan(seed: int) -> None:
    assert _run_dynamic(TopologicalSorter(), seed) == _run_dynamic(_FullScanTopologicalSorter(), seed)


def test_prepare_after_done_keeps_insertion_order() -> None:
    sorter = TopologicalSorter()
    sorter.add('a')
    sorter.add('b')
    sorter.add('c', 'b')
    sorter.add('d', 'a')
    sorter.prepare()
    assert sorter.get_ready() == ('a', 'b')
    sorter.done('b', 'a')  # 'c' becomes ready before 'd'
    sorter.add('e')
    sorter.prepare()
    assert sorter.get_ready() == ('c', 'd', 'e')


def test_prepare_only_scans_new_nodes() -> None:
    sorter = TopologicalSorter()
    for i in range(100):
        sorter.add(i)
    sorter.prepare()
    sorter.get_ready()
    sorter.add('new', 0)
    assert len(sorter._added_since_prepare) == 1
    sorter.prepare()
    assert sorter._added_since_prepare == []
    assert sorter.get_ready() == ()
