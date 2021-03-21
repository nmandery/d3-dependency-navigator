

export interface Node {
    name: string,
    class: string,
    group: number
}

export interface Link {
    source: number,
    target: number,
    value: number,
    type: string
}

export interface Graph {
    nodes: Node[],
    links: Link[]
}
