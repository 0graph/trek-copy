import { setMarkerStyles } from "./mapStyles.js";

export default class ClusterGroup {
    constructor() {
        this.mapLayerGroup = L.layerGroup(); // layer for route planning markers
        this.clusterGroup =  L.markerClusterGroup({ // layer for campsites, access points, picnic areas
            showCoverageOnHover: true,
            zoomToBoundsOnClick: true,
            disableClusteringAtZoom: 15
        }).addTo(this.mapLayerGroup);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { // initialize map with tile layer 
        maxZoom: 18,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this.clusterGroup);

        this.baseURL = "http://52.15.34.182:8080/geoserver/wfs?service=wfs&version=2.0.0&request=getfeature&typename="; //Geographic Web File Service
        this.respFormat = "&outputFormat=application/json";
        this.markers = this.addLayer('Rec_point'); // add campsite, picnic, building markers
        this.path = undefined; // layer that defines users selected route
    }


    initLayers() {
        this.mapLayerGroup = L.layerGroup();
    }

    async addLayer(layerName) {
        this.getLayer(layerName)
            .then((data) =>  {
                var layers = [];
                if (layerName === 'Rec_point') { 
                    layers = this.splitLayerBySubtype(data); // Split different features into individual layers - comes as one layer from geoserver
                } else {

                }

                for (const [subtype, features] of Object.entries(layers)) { // loop through individual layers
                    var styledLayer = setMarkerStyles(subtype, features); // set marker styles for each individual layer 
                    styledLayer.addTo(this.clusterGroup);
                }

                // const layer = this.setMarkerStyles(data); // customize layer icons 
                // layer.addTo(this.clusterGroup); // add layer to layer group
                // console.log(layer);
            })
            .catch(err => console.log("Rejected: " + err.message));
    }

    splitLayerBySubtype(geoJSON) {
        var subTypes = {};
        var allFeatures = geoJSON.features;

        // process geoJSON and separate into individual layers
        allFeatures.forEach(function (feature) {
            var type = feature.properties.SUBTYPE;
            if (type in subTypes) { // if subtype exists - append feature to list
                subTypes[type].push(feature);
            } else {
                subTypes[type] = []; // create new key 
                subTypes[type].push(feature); // append new feature
            }
        });

        return subTypes;
    }
    
    async addPath(sourceID, targetID) {
        if(this.path != undefined) this.path.remove();
        this.getPath(sourceID, targetID)
        .then(data =>  this.path = L.geoJSON(data).addTo(this.mapLayerGroup)) // add layer to layer group
        .catch(err => console.log("Rejected: " + err.message));
    }
    
    // Request a layer from the Geoserver
    async getLayer(layerName) {
        const response = await fetch(this.baseURL + layerName + this.respFormat);
        const geoJSON = await response.json();
        return geoJSON;
    }
    
    async getNearestVertex(point) {
        var url = `${this.baseURL}nearest_vertex${this.respFormat}&viewparams=x:${point.lng};y:${point.lat};`;
        const response = await fetch(url);
        return response.json();
    }
    
    async getPath(sourceID, targetID) {
        var url = `${this.baseURL}shortest_path${this.respFormat}&viewparams=source:${sourceID};target:${targetID};`;
        const response = await fetch(url);
        // console.log(response);
        return response.json();
    }

    setMarkerStyles(layer) {
        const icons =  { // icon styles for various features
            "Designated Camping Site": L.icon({
                iconUrl: '../../src/frontend/assets/tent.svg',
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -32],
            }),
            
            "Access Point": L.icon({
                iconUrl: '../../src/frontend/assets/access.svg',
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -32],
            }),
    
    
        };
    
        layer = L.geoJSON(layer, { // process function for each feature from geoJSON
            pointToLayer: function (feature, latlng) {
                const subtype = feature.properties.SUBTYPE; // get the subtype of the feature from geoJSON file
                
                if (subtype in icons) {
                    return L.marker(latlng, { icon: icons[subtype] }); // assigned the icon for a feature 
                } else {
                    console.log("Subtype not found in icons dict");
                }
            }
        });
    
        return layer;
    }

    removeLayer(layerName) {
        this.clusterGroup.removeLayer(layerName);
    }
    
    
}
