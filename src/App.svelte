<script lang="ts">
    import DependencyGraph from './DependencyGraph.svelte';
    import * as d3 from "d3";

    let data = {};
    function loadData() {
        d3.json('dependencies.json').then(d => {
            data = d;
        })
    }

    loadData();
</script>

<DependencyGraph data="{data}"/>

<style>
</style>
