"""Reproduction: a ComponentNode shared by two parents is disposed out from
under the second parent when the first parent stops referencing it.

The trigger (one parent re-targets its child) is what an ``updateComponents``
message does at runtime: MessageProcessor._process_update_components applies it
via ``existing.properties = final_properties``, the same setter used below.

Run: uv run pytest agent_sdks/python/a2ui_core/tests/test_shared_node_dispose_repro.py -v
"""
import json
from pathlib import Path

from a2ui.core.state import ComponentModel, ComponentNode, NodeGraph, SurfaceModel
from a2ui.core.basic_catalog import BasicCatalog

_MOVIE_CARD = (
    Path(__file__).resolve().parents[4]
    / "specification/v1_0/catalogs/basic/examples/29_movie-card.json"
)


def _find(nodes, component_id):
    return next(n for n in nodes if n.component_id == component_id)


def _components(doc):
    out = []

    def walk(node):
        if isinstance(node, dict):
            if isinstance(node.get("components"), list):
                out.extend(node["components"])
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(doc)
    return out


def _node_for(props, component_id):
    found = []

    def walk(value):
        if isinstance(value, ComponentNode) and value.component_id == component_id:
            found.append(value)
        elif isinstance(value, dict):
            for item in value.values():
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)

    walk(props)
    return found[0] if found else None


def test_shared_child_survives_one_parent_dropping_it():
    catalog = BasicCatalog()
    surface = SurfaceModel("surf-1", catalog)
    surface.data_model.set("/msg", "hello")

    # A Column with two Cards, both pointing at the same child "shared".
    surface.components_model.add_component(
        ComponentModel("root", "Column", {"children": ["card_a", "card_b"]})
    )
    surface.components_model.add_component(
        ComponentModel("card_a", "Card", {"child": "shared"})
    )
    surface.components_model.add_component(
        ComponentModel("card_b", "Card", {"child": "shared"})
    )
    surface.components_model.add_component(
        ComponentModel("shared", "Text", {"text": {"path": "/msg"}})
    )
    surface.components_model.add_component(
        ComponentModel("other", "Text", {"text": "different"})
    )

    graph = NodeGraph(surface)
    root = graph.rootNode.value
    assert root is not None

    cards = root.props.value["children"]
    card_a = _find(cards, "card_a")
    card_b = _find(cards, "card_b")
    shared_via_a = card_a.props.value["child"]
    shared_via_b = card_b.props.value["child"]

    # Premise: both parents hold the exact same node instance, live.
    assert shared_via_a is shared_via_b
    assert shared_via_a.props.value["text"] == "hello"

    # An updateComponents re-targets card_a at a different child. The "shared"
    # component still exists in the model; only card_a stopped referencing it.
    surface.components_model.get("card_a").properties = {"child": "other"}

    # card_b still references "shared", so its node must stay alive...
    assert shared_via_b._disposed is False, (
        "shared node was disposed even though card_b still references it"
    )
    # ...and stay reactive: a change to the bound data must reach it.
    surface.data_model.set("/msg", "world")
    assert card_b.props.value["child"].props.value["text"] == "world", (
        "card_b's subtree went stale after card_a dropped the shared child"
    )


def test_official_movie_card_shares_a_button_that_disposal_can_kill():
    """The shipped movie-card gallery example references one Button ('Watch
    Trailer') from both the content Column and the Modal trigger. It resolves to
    a single shared node; a later content re-layout disposes it out from under
    the still-referencing modal trigger."""
    components = _components(json.loads(_MOVIE_CARD.read_text()))

    surface = SurfaceModel("movie", BasicCatalog())
    for c in components:
        props = {k: v for k, v in c.items() if k not in ("id", "component")}
        surface.components_model.add_component(
            ComponentModel(c["id"], c["component"], props)
        )

    graph = NodeGraph(surface)
    assert graph.rootNode.value is not None

    content = graph.active_nodes["content"]
    modal = graph.active_nodes["trailer_modal"]
    via_content = _node_for(content.props.value, "watch_trailer_btn")
    via_modal = _node_for(modal.props.value, "watch_trailer_btn")

    # The official example shares one Button node between two parents.
    assert via_content is not None and via_modal is not None
    assert via_content is via_modal

    # A later updateComponents re-lays-out the content column without the button.
    # The button component still exists and is still the modal's trigger.
    content_model = surface.components_model.get("content")
    kept = [c for c in content_model.properties.get("children", []) if c != "watch_trailer_btn"]
    content_model.properties = {**content_model.properties, "children": kept}

    assert via_modal._disposed is False, (
        "the movie-card's shared Button was disposed out from under the modal trigger"
    )


_AGENT_CARD = Path(__file__).resolve().parent / "data" / "agent_generated_subscription_card.json"


def test_agent_generated_card_shares_a_button_that_disposal_can_kill():
    """A UI generated verbatim by an LLM (gemini-flash-latest) for the prompt
    'a subscription card with a Cancel button that opens a cancellation modal'.
    The agent put one Button ('cancel_button') in the card's action Row AND used
    it as the Modal's trigger. It resolves to one shared node; dropping the
    action-row reference disposes it out from under the still-referencing modal."""
    components = json.loads(_AGENT_CARD.read_text())

    surface = SurfaceModel("subscription", BasicCatalog())
    for c in components:
        props = {k: v for k, v in c.items() if k not in ("id", "component")}
        surface.components_model.add_component(
            ComponentModel(c["id"], c["component"], props)
        )

    graph = NodeGraph(surface)
    assert graph.rootNode.value is not None

    actions_row = graph.active_nodes["actions_row"]
    modal = graph.active_nodes["cancel_modal"]
    via_row = _node_for(actions_row.props.value, "cancel_button")
    via_modal = _node_for(modal.props.value, "cancel_button")

    assert via_row is not None and via_modal is not None
    assert via_row is via_modal

    # The card's action row re-lays out without the Cancel button (still the
    # modal's trigger; the button component still exists).
    row_model = surface.components_model.get("actions_row")
    kept = [c for c in row_model.properties.get("children", []) if c != "cancel_button"]
    row_model.properties = {**row_model.properties, "children": kept}

    assert via_modal._disposed is False, (
        "the agent-generated card's shared Cancel button was disposed out from "
        "under the modal trigger"
    )
