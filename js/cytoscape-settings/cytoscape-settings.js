cytoscapeSettings = {
    container: document.getElementById("cy"),
    style: [
        {
            selector: "node",
            css: {
                content: "data(name)",
                "text-valign": "center",
                "text-halign": "center",
                "background-color": "white",
                "line-color": "red",
                "target-arrow-color": "#61bffc",
                "transition-property": "background-color, line-color, target-arrow-color",
                "transition-duration": "0.5s",
                "padding-top": "5px",
                "padding-right": "5px",
                "padding-bottom": "5px",
                "padding-left": "5px",
                "border-width": 2,
                "border-color": "black",
                "font-size": "10px",
                "text-wrap": "wrap",
                "text-max-width": "70px",
                "width": "label",
                "height": "label",
                "shape": "roundrectangle",
            },
        },
        {
            selector: "edge",
            css: {
                "target-arrow-shape": "triangle",
                width: 4,
                "line-color": "lightgray",
                "target-arrow-color": "lightgray",
                label: "1",
                "text-valign": "right",
            },
        },
        {
            selector: ".edgehandles-hover",
            css: {
                "border-width": 3,
                "border-color": "black",
            },
        },
        {
            selector: ".edgehandles-source",
            css: {
                "border-width": 3,
                "border-color": "black",
            },
        },
        {
            selector: ".edgehandles-target",
            css: {
                "border-width": 3,
                "border-color": "black",
            },
        },
        {
            selector: ".edgehandles-preview",
            css: {
                "line-color": "darkgray",
                "target-arrow-color": "darkgray",
                "source-arrow-color": "darkgray",
            },
        },
        {
            selector: "node:selected",
            css: {
                "border-width": 3,
                "border-color": "#000000",
            },
        },
        {
            selector: "edge:selected",
            css: {
                "line-color": "darkgray",
                "target-arrow-color": "darkgray",
            },
        },
        {
            selector: ".highlighted",
            css: {
                "background-color": "#ad1a66",
                "line-color": "#ad1a66",
                "target-arrow-color": "#ad1a66",
                "transition-property":
                "background-color, line-color, target-arrow-color",
                "transition-duration": "0.5s",
            },
        },
        {
            selector: ".min-cut-edge",
            css: {
                "line-color": "#d9534f",
                "target-arrow-color": "#d9534f",
                width: 6,
                "line-style": "solid",
                "font-weight": "bold",
                "color": "#d9534f",
                "transition-property": "line-color, target-arrow-color, width",
                "transition-duration": "0.4s",
            },
        },
        {
            selector: ".blocked-edge",
            css: {
                "line-color": "#d9534f",
                "target-arrow-color": "#d9534f",
                "line-style": "dashed",
                width: 3,
                "color": "#d9534f",
            },
        },
        {
            selector: ".restricted-edge",
            css: {
                "line-color": "#f0ad4e",
                "target-arrow-color": "#f0ad4e",
                "line-style": "dashed",
                width: 4,
                "color": "#f0ad4e",
            },
        },
    ],
    layout: {
        name: "preset",
        directed: true,
        roots: "#a",
        padding: 10,
    },
    userPanningEnabled: true,
    zoomingEnabled: true,
    userZoomingEnabled: true,
    selectionType: "single",
    minZoom: 0.5, // sets the minimum zoom level
    maxZoom: 2, // sets the maximum zoom level
};