<div style="width:{ width }px;height:{height}px;">
    <svg width="100%" height="100%" bind:this={svgElement}>
        <defs>
            <pattern id="innerGrid" width="{innerGridSize}" height="{innerGridSize}" patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%" fill="none" stroke="#CCCCCC7A" stroke-width="0.5"/>
            </pattern>
            <pattern id="grid" width="{gridSize}" height="{gridSize}" patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%" fill="url(#innerGrid)" stroke="#CCCCCC7A" stroke-width="1.5"/>
            </pattern>
        </defs>
    </svg>
</div>

<script>
    import * as d3 from 'd3';
    import {onMount} from 'svelte';

    export let width = window.innerWidth - 10;
    export let height = window.innerHeight - 10;
    export let gridSize = 100;
    let innerGridSize = gridSize / 10;
    let selections = {};
    export let data = {};
    $: {
        updateData(data);
    }

    let simulation = d3.forceSimulation()
        .force("link", d3.forceLink())
        .force("charge", d3.forceManyBody())
        .force("collide", d3.forceCollide())
        .force("center", d3.forceCenter())
        .force("forceX", d3.forceX())
        .force("forceY", d3.forceY())
        .on("tick", tick);

    // Call first time to setup default values
    let forceProperties = {
        center: {
            x: 0.5,
            y: 0.5
        },
        charge: {
            enabled: true,
            strength: -700,
            distanceMin: 1,
            distanceMax: 2000
        },
        collide: {
            enabled: true,
            strength: .7,
            iterations: 1,
            radius: 35
        },
        forceX: {
            enabled: true,
            strength: 0.05,
            x: 0.5
        },
        forceY: {
            enabled: true,
            strength: 0.35,
            y: 0.5
        },
        link: {
            enabled: true,
            distance: 100,
            iterations: 1
        }
    };
    let svgElement;
    let zoom;

    function nodes() {
        return data.nodes || []
    }

    function links() {
        return data.links || []
    }

    // These are needed for captions
    function linkTypes() {
        const linkTypes = []
        links().forEach(link => {
            if (linkTypes.indexOf(link.type) === -1)
                linkTypes.push(link.type)
        })
        return linkTypes.sort()
    }

    function classes() {
        const classes = []
        nodes().forEach(node => {
            if (classes.indexOf(node.class) === -1)
                classes.push(node.class)
        })
        return classes.sort()
    }

    function tick() {
        if (!data || !selections.graph) {
            return
        }
        const transform = d => {
            return "translate(" + d.x + "," + d.y + ")"
        }

        const link = d => {
            // Self-link support
            if (d.source.index === d.target.index) {
                return `M${d.source.x - 1},${d.source.y - 1}A30,30 -10,1,0 ${d.target.x + 1},${d.target.y + 1}`;
            } else {
                return "M" + d.source.x + "," + d.source.y + " L" + d.target.x + "," + d.target.y;
            }
        }

        selections.graph.selectAll("path").attr("d", link)
        selections.graph.selectAll("circle").attr("transform", transform)
        selections.graph.selectAll("text").attr("transform", transform)

        //updateNodeLinkCount()
    }

    function updateData(data) {
        simulation.nodes(nodes())
        simulation.force("link").links(links())

        if (!selections.graph) {
            return
        }
        // Links should only exit if not needed anymore
        selections.graph.selectAll("path")
            .data(links())
            .exit().remove()

        selections.graph.selectAll("path")
            .data(links())
            .enter().append("path")
            .attr("class", d => "link " + d.type)

        // Nodes should always be redrawn to avoid lines above them
        selections.graph.selectAll("circle").remove()
        selections.graph.selectAll("circle")
            .data(nodes())
            .enter().append("circle")
            .attr("r", 30)
            .attr("class", d => d.class)
            .call(d3.drag()
                .on('start', nodeDragStarted)
                .on('drag', nodeDragged)
                .on('end', nodeDragEnded))
            .on('mouseover', nodeMouseOver)
            .on('mouseout', nodeMouseOut)
            .on('click', nodeClick)

        selections.graph.selectAll("text").remove()
        selections.graph.selectAll("text")
            .data(nodes())
            .enter().append("text")
            .attr("x", 0)
            .attr("y", ".31em")
            .attr("text-anchor", "middle")
            .text(d => d.name)

        // Add 'marker-end' attribute to each path
        const svg = d3.select(svgElement)
        svg.selectAll("g").selectAll("path").attr("marker-end", d => {
            // Caption items doesn't have source and target
            if (d.source && d.target &&
                d.source.index === d.target.index) return "url(#end-self)";
            else return "url(#end)";
        });

        // Update caption every time data changes
        updateCaption()
        simulation.alpha(1).restart()
    }

    function updateForces() {
        simulation.force("center")
            .x(width * forceProperties.center.x)
            .y(height * forceProperties.center.y)
        simulation.force("charge")
            .strength(forceProperties.charge.strength * forceProperties.charge.enabled)
            .distanceMin(forceProperties.charge.distanceMin)
            .distanceMax(forceProperties.charge.distanceMax)
        simulation.force("collide")
            .strength(forceProperties.collide.strength * forceProperties.collide.enabled)
            .radius(forceProperties.collide.radius)
            .iterations(forceProperties.collide.iterations)
        simulation.force("forceX")
            .strength(forceProperties.forceX.strength * forceProperties.forceX.enabled)
            .x(width * forceProperties.forceX.x)
        simulation.force("forceY")
            .strength(forceProperties.forceY.strength * forceProperties.forceY.enabled)
            .y(height * forceProperties.forceY.y)
        simulation.force("link")
            .distance(forceProperties.link.distance)
            .iterations(forceProperties.link.iterations)

        // updates ignored until this is run
        // restarts the simulation (important if simulation has already slowed down)
        simulation.alpha(1).restart()
    }

    function updateNodeLinkCount() {
        let nodeCount = nodes().length;
        let linkCount = links().length;

        const highlightedNodes = selections.graph.selectAll("circle.highlight");
        const highlightedLinks = selections.graph.selectAll("path.highlight");
        if (highlightedNodes.size() > 0 || highlightedLinks.size() > 0) {
            nodeCount = highlightedNodes.size()
            linkCount = highlightedLinks.size()
        }
        selections.stats.text('Nodes: ' + nodeCount + ' / Edges: ' + linkCount);
    }

    function updateCaption() {
        // WARNING: Some gross math will happen here!
        const lineHeight = 30
        const lineMiddle = (lineHeight / 2)
        const captionXPadding = 28
        const captionYPadding = 5
        const _linkTypes = linkTypes()

        const caption = selections.caption;
        caption.select('rect')
            .attr('height', (captionYPadding * 2) + lineHeight *
                (classes().length + _linkTypes.length))

        const linkLine = (d) => {
            const source = {
                x: captionXPadding + 13,
                y: captionYPadding + (lineMiddle + 1) + (lineHeight * _linkTypes.indexOf(d)),
            }
            const target = {
                x: captionXPadding - 10,
            }
            return 'M' + source.x + ',' + source.y + 'H' + target.x
        }

        caption.selectAll('g').remove();
        const linkCaption = caption.append('g');
        linkCaption.selectAll('path')
            .data(_linkTypes)
            .enter().append('path')
            .attr('d', linkLine)
            .attr('class', (d) => 'link ' + d)

        linkCaption.selectAll('text')
            .data(_linkTypes)
            .enter().append('text')
            .attr('x', captionXPadding + 20)
            .attr('y', (d) => captionYPadding + (lineMiddle + 5) +
                (lineHeight * _linkTypes.indexOf(d)))
            .attr('class', 'caption')
            .text((d) => d);

        const classCaption = caption.append('g');
        const _classes = classes();
        classCaption.selectAll('circle')
            .data(_classes)
            .enter().append('circle')
            .attr('r', 10)
            .attr('cx', captionXPadding - 2)
            .attr('cy', (d) => captionYPadding + lineMiddle +
                (lineHeight * (_linkTypes.length + _classes.indexOf(d))))
            .attr('class', (d) => d.toLowerCase());

        classCaption.selectAll('text')
            .data(_classes)
            .enter().append('text')
            .attr('x', captionXPadding + 20)
            .attr('y', (d) => captionYPadding + (lineMiddle + 5) +
                (lineHeight * (_linkTypes.length + _classes.indexOf(d))))
            .attr('class', 'caption')
            .text((d) => d);

        const captionWidth = caption.node().getBBox().width;
        const captionHeight = caption.node().getBBox().height;
        const paddingX = 18;
        const paddingY = 12;
        caption
            .attr('transform', 'translate(' +
                (width - captionWidth - paddingX) + ', ' +
                (height - captionHeight - paddingY) + ')');
    }

    function zoomed(e) {
        const transform = e.transform
        // The trick here is to move the grid in a way that the user doesn't perceive
        // that the axis aren't really moving
        // The actual movement is between 0 and gridSize only for x and y
        const translate = transform.x % (gridSize * transform.k) + ',' +
            transform.y % (gridSize * transform.k)
        selections.grid.attr('transform', 'translate(' +
            translate + ') scale(' + transform.k + ')')
        selections.graph.attr('transform', transform)

        // Define some world boundaries based on the graph total size
        // so we don't scroll indefinitely
        const graphBox = selections.graph.node().getBBox()
        const margin = 200
        const worldTopLeft = [graphBox.x - margin, graphBox.y - margin]
        const worldBottomRight = [
            graphBox.x + graphBox.width + margin,
            graphBox.y + graphBox.height + margin
        ]
        zoom.translateExtent([worldTopLeft, worldBottomRight])
    }

    function nodeDragStarted(event, d) {
        if (!event.active) {
            simulation.alphaTarget(0.3).restart()
        }
        d.fx = d.x
        d.fy = d.y
    }

    function nodeDragged(event, d) {
        d.fx = event.x
        d.fy = event.y
    }

    function nodeDragEnded(event, d) {
        if (!event.active) {
            simulation.alphaTarget(0.0001)
        }
        d.fx = null
        d.fy = null
    }

    function nodeMouseOver(event, d) {

        const related = []
        const relatedLinks = []
        related.push(d)
        simulation.force('link').links().forEach((link) => {
            if (link.source === d || link.target === d) {
                relatedLinks.push(link)
                if (related.indexOf(link.source) === -1) {
                    related.push(link.source)
                }
                if (related.indexOf(link.target) === -1) {
                    related.push(link.target)
                }
            }
        })
        const circle = selections.graph.selectAll("circle")
        const path = selections.graph.selectAll("path")
        const text = selections.graph.selectAll("text")
        circle.classed('faded', true)
        circle
            .filter((df) => related.indexOf(df) > -1)
            .classed('highlight', true)
        path.classed('faded', true)
        path
            .filter((df) => df.source === d || df.target === d)
            .classed('highlight', true)
        text.classed('faded', true)
        text
            .filter((df) => related.indexOf(df) > -1)
            .classed('highlight', true)
        // This ensures that tick is called so the node count is updated
        simulation.alphaTarget(0.0001).restart()
    }

    function nodeMouseOut(event, d) {
        const circle = selections.graph.selectAll("circle")
        const path = selections.graph.selectAll("path")
        const text = selections.graph.selectAll("text")

        circle.classed('faded', false)
        circle.classed('highlight', false)
        path.classed('faded', false)
        path.classed('highlight', false)
        text.classed('faded', false)
        text.classed('highlight', false)
        // This ensures that tick is called so the node count is updated
        simulation.restart()
    }

    function nodeClick(event, d) {
        const circle = selections.graph.selectAll("circle")
        circle.classed('selected', false)
        circle.filter((td) => td === d)
            .classed('selected', true)
    }

    onMount(() => {
        updateForces(); // set defaults

        selections.svg = d3.select(svgElement)
        const svg = selections.svg

        // Define the arrow marker
        svg.append("svg:defs").selectAll("marker")
            .data(["end"])     // Different link/path types can be defined here
            .enter().append("svg:marker")    // This section adds in the arrows
            .attr("id", String)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 43)              // Prevents arrowhead from being covered by circle
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("svg:path")
            .attr("d", "M0,-5L10,0L0,5");

        // Define arrow for self-links
        svg.append("svg:defs").selectAll("marker")
            .data(["end-self"])
            .enter().append("svg:marker")    // This section adds in the arrows
            .attr("id", String)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 40)
            .attr("refY", -15)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", 285)
            .append("svg:path")
            .attr("d", "M0,-5L10,0L0,5");

        // Add zoom and panning triggers
        zoom = d3.zoom()
            .scaleExtent([1 / 4, 4])
            .on('zoom', zoomed)
        svg.call(zoom)

        // A background grid to help user experience
        // The width and height depends on the minimum scale extent and
        // the + 10% and negative index to create an infinite grid feel
        // The precedence of this element is important since you'll have
        // click events on the elements above the grid
        selections.grid = svg.append('rect')
            .attr('x', '-10%')
            .attr('y', '-10%')
            .attr('width', '410%')
            .attr('height', '410%')
            .attr('fill', 'url(#grid)')

        selections.graph = svg.append("g")
        const graph = selections.graph

        // Node and link count is nice :)
        selections.stats = svg.append('text')
            .attr('x', '1%')
            .attr('y', '98%')
            .attr('text-anchor', 'left');

        // Some caption
        selections.caption = svg.append('g');
        selections.caption.append('rect')
            .attr('width', '200')
            .attr('height', '0')
            .attr('rx', '10')
            .attr('ry', '10')
            .attr('class', 'caption');
    })
</script>

<style>

</style>
