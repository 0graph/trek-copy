import { setMarkerStyles, setPathStyles } from "./mapStyles.js";
import { mapSettings } from "./mapSettings.js";

const serverURL = "https://algonquin-api.geo-base.org:8080/geoserver/wfs?service=wfs&version=2.0.0&request=getfeature&typename="; //Geographic Web File Service

const PathMarker = L.Marker.extend({
    options: {
        index: 0,
        nearestVertex: 0
    }
});

export const pathMarker = function (latlng, options) {
    return new PathMarker(latlng, options);
};

export default class ClusterGroup {
    constructor(mapSettings) {
        this.allLayers = {}; // dictionary containing layer identifiers, layer object pairs
        this.mapLayerGroup = L.layerGroup(); // layer for route planning markers
        this.clusterGroup =  L.markerClusterGroup({ // layer for campsites, access points, picnic areas
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            removeOutsideVisibleBounds: true,
            disableClusteringAtZoom: 14,
            iconCreateFunction :    function (cluster){
                var cluster_markers = cluster.getAllChildMarkers();
                var n = 0;
                n += cluster_markers.length;
                var scaledSize = Math.min(20, Math.max(10, n));
                return  L.divIcon({
                    html: '<div class="mycluster1"><img src="../../src/frontend/assets/tent.svg" alt="Tent"><div class="cluster-text">' + n + '</div></div>',
                    className: 'mycluster1',
                    iconSize: L.point(scaledSize, scaledSize)
                });
            } 
        },
        ).addTo(this.mapLayerGroup);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { // initialize map with tile layer 
        maxZoom: 18,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this.clusterGroup);

        this.baseURL = serverURL;
        this.respFormat = "&outputFormat=application/json";
        this.markers = this.addLayer('Rec_point'); // campsites, access points, picnic area feature layer
        //this.trails = this.addLayer('apt_seg'); //trails, portages, canoe routes
        this.mapSettings = mapSettings;

        //Multipoint Routing
        this.pathlist = []; //list of paths for markers
        this.markerlist = []; //list of markers for paths
        this.pathDatalist = []; //Data for path
        this.directionMarkers = [];
        this.totalPath = [] // contains an array of pathdatalist 

        this.directionMarkerIcon = new L.Icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [12, 24],
            iconAnchor: [6, 24],
            popupAnchor: [1, -34],
            shadowSize: [10, 10]
        });
    }

    initLayers() {
        this.mapLayerGroup = L.layerGroup();
    }

    async addLayer(layerName) {
        if (layerName in this.allLayers) { // add existing layer to the group
            this.allLayers[layerName].addTo(this.clusterGroup);
            return;
        }

        this.getLayer(layerName) // request layer if it doesn't exist
            .then((data) =>  {
                var layers = [];
                if (layerName === 'Rec_point') { 
                    layers = this.splitLayerBySubtype(data); // Split different features into individual layers - comes as one layer from geoserver
                } 

                if(layerName === 'apt_seg') {
                    var trails = setPathStyles(data, false);
                    // this.allLayers[layerName] = trails;
                    trails.addTo(this.clusterGroup);
                }

                for (const [subtype, features] of Object.entries(layers)) { // loop through individual layers
                    var styledLayer = setMarkerStyles(subtype, features); // set marker styles for each individual layer 
                    styledLayer.addTo(this.clusterGroup); // add styled layer to cluster group
                    this.allLayers[subtype] = styledLayer; // add new layer to layer dictionary
                }
            })
            .catch(err => console.log("Rejected: " + err.message));
    }
    
    async addPath(index,sourceID, targetID, onCreateMarker) {
        if(onCreateMarker != true) {
            this.removePath(index);
        }
        console.log(`New Path [${index}] - from ${sourceID} to ${targetID}`);
        await this.getPath(sourceID, targetID)
        .then(async data => {
            var newPath = setPathStyles(data,true).addTo(this.mapLayerGroup);
            if(onCreateMarker == true) { //if a new marker is being created, instead of overwriting the old path, move it further in the array
                this.pathlist.splice(index,0,newPath);
                this.pathDatalist.splice(index,0,data);
            } else {
                this.pathlist[index] = newPath;
                this.pathDatalist[index] = data;
            }
            //add name hover for path segment
            //can also add distance easily
            //and maybe add highlighting when
            for(var p in newPath._layers) {
                var e = newPath._layers[p];
                e.bindPopup(e.feature.properties.name);
                e.on('mouseover', function (e) {
                    this.openPopup();
                    this.setStyle({
                        color: '#D92701',
                        weight: 4.4
                    })
                });
                e.on('mouseout', function (e) {
                    this.closePopup();
                    this.setStyle({
                        color: '#0093FF',
                        weight: 3
                    })
                });
            }

            this.pathlist[index].on('click', async (e) => {
                //console.log("Path index ", index, " clicked!");
                await this.addPathMarker(index+1, e.latlng,false);
            });
        }) // add layer to layer group
        .catch(err => console.log("Rejected: " + err.message));

        return this.pathDatalist;
    }

    removePath(index) {
        if(this.pathlist[index] != undefined) this.pathlist[index].remove();
    }
    
    // Request a layer from the Geoserver
    async getLayer(layerName) {
        const response = await fetch(this.baseURL + layerName + this.respFormat);
        const geoJSON = await response.json();
        return geoJSON;
    }
    
    // Gets the nearest node on the map from a given coordinate
    async getNearestVertex(point) {
        var url = `${this.baseURL}nearest_vertex${this.respFormat}&viewparams=x:${point.lng};y:${point.lat};`;
        const response = await fetch(url);
        const geoJSON = await response.json();
        return geoJSON;
    }
    
    async getPath(sourceID, targetID) {
        var url = `${this.baseURL}shortest_path${this.respFormat}&viewparams=source:${sourceID};target:${targetID};`;
        const response = await fetch(url);
        const geoJSON = await response.json();
        return geoJSON;
    }

    async getSegmentByID(ID) {
        var url = `${this.baseURL}get_segment${this.respFormat}&viewparams=oid:${ID};`;
        const response = await fetch(url);
        const obj = await response.json();
        return obj.features[0];
    }

    //pass in a string of CSVs -> "1,23,45"
    async getSegmentByIDs(IDs) {
        var url = `${this.baseURL}Algonquin_Network&cql_filter=id IN (${IDs})${this.respFormat}`;
        const response = await fetch(url);
        const obj = await response.json();
        return obj.features;
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


    async createDirectionsFromPath(pathData) {
        const directions = [];
        if(pathData.length == 0 || pathData[0].features.length == 0) {
            return directions;
        }
        var startPOS = pathData[0].features[0].geometry.coordinates[0][0];
        console.log(pathData[0].features[0]);
        var lastPathObj = await this.getSegmentByID(pathData[0].features[0].properties.oid);
        var pathobj;
        var oidList = "";

        //build list
        for(const path of pathData) {
            if(path.features.length == 0) continue;
            for(const edge of path.features) {
                oidList = oidList + edge.properties.oid + ",";
            }
        }
        
        oidList = oidList.slice(0, -1);
        var pathObjects = await this.getSegmentByIDs(oidList);
        for(const pobj of pathObjects) {
            pathobj = pobj;
            
            if(lastPathObj.properties.ogf_id != pobj.properties.ogf_id && lastPathObj.properties.name != pobj.properties.name) { 
                //Distance should be included in here
                //but Algonquin_Network table must be updated with distance parameter first
                directions.push({name: pobj.properties.name, type: pobj.properties.type, pos: startPOS});
                lastPathObj = pobj;
                startPOS = pobj.geometry.coordinates[0];
            }
        }
        const endElement = pathData[pathData.length - 1];
        const geom = endElement.features[endElement.features.length - 1].geometry;
        const endPOS = geom.coordinates[0][geom.coordinates[0].length - 1];
        directions.push({name: pathobj.properties.name, type: pathobj.properties.type, pos: endPOS});

        //console.log("Dir: ", directions);
        return directions;

    }

    async addDirectionsToSidebar(pdata) {
        for(const marker of this.directionMarkers) {
            marker.remove();
        }
        //console.log("Adding Direction to Sidebar!", pdata);
        this.directionMarkers = [];
        
        const data = await this.createDirectionsFromPath(pdata);
        
        const outputDiv = document.getElementById('directions-table');
        outputDiv.innerHTML = '';
    
        data.forEach((item, index) => {
            const liElement = document.createElement('div');
            liElement.classList.add('table-row');
    
            liElement.innerHTML = `
                <div class="table-cell ...">${item.name}</div>
                <div class="table-cell ...">${item.distance}</div>`;
    
            outputDiv.appendChild(liElement);

            if(this.mapSettings.dispdir) {
                var marker = L.marker([item.pos[1], item.pos[0]], {icon: this.directionMarkerIcon}).addTo(this.mapLayerGroup);
                marker.bindPopup(`${item.name}\nType: ${item.type}`);
                this.directionMarkers.push( marker );
            }
        });
    }

    hideLayer(layerName) {
        if (layerName in this.allLayers) {
            this.clusterGroup.removeLayer(this.allLayers[layerName]);
        }
    }

    showLayer(layerName) {
        if (layerName in this.allLayers) {
            this.clusterGroup.addLayer(this.allLayers[layerName]);
        }
    }

    getClusterGroup() {
        console.log(this.clusterGroup.getLayers());
        return this.clusterGroup;
    }

    // Returns the start and end markers from path
    getPathEndPoints() {
        const endPoints = [];

        if (this.markerlist.length > 1) { // if there exists a path 
            endPoints.append(this.markerlist[0]); // get start marker
            endPoints.append(this.markerlist[this.markerlist.length - 1]); // get end marker
        }

        return endPoints;
    }

    async regenPaths(idx,onDeleteMarker,onCreateMarker) {
        //console.log(`Before - Regen: [${idx}] OnDel: [${onDeleteMarker}] MLen: [${this.markerlist.length}] PLen: [${this.pathlist.length}]`);
        if(this.markerlist.length > 1 && idx < this.markerlist.length) { 
            var m = this.markerlist[idx];
            if(idx == 0) {
                await this.addPath(idx, m.options.nearestVertex, this.markerlist[idx+1].options.nearestVertex,onCreateMarker);
            } else if(idx < this.markerlist.length - 1 && !onDeleteMarker){
                await this.addPath(idx, m.options.nearestVertex, this.markerlist[idx+1].options.nearestVertex,onCreateMarker);
                await this.addPath(idx - 1, this.markerlist[idx-1].options.nearestVertex, m.options.nearestVertex,false);
            } else {
                if(onDeleteMarker) {
                    this.pathlist[idx].remove();
                    this.pathDatalist.splice(idx,1);
                    this.pathlist.splice(idx,1);
                    var m = this.markerlist[idx];
                }
                await this.addPath(idx - 1, this.markerlist[idx-1].options.nearestVertex, m.options.nearestVertex,false);
            }
        }
        //console.log(`After - Regen: [${idx}] OnDel: [${onDeleteMarker}] MLen: [${this.markerlist.length}] PLen: [${this.pathlist.length}]`);
        //await this.addDirectionsToSidebar(this.pathDatalist);
        return;
    }

    async makeMarker(idx,pos,isStartOrEnd,customIcon) {
        var m = pathMarker(pos,
            {   draggable: true,
                autoPan: true,
                index: idx,
                nearestVertex: (await this.getNearestVertex(pos)).features[0].properties.id,
            }).addTo(this.mapLayerGroup);

        if(customIcon != undefined) {
            m.setIcon(customIcon);
        }

        m.on('dragend', async (event) => {
            console.log("Disabled Dragging");
            m.dragging.disable();
            var S_latlng = event.target.getLatLng();
            var sResponse = await this.getNearestVertex(S_latlng);
            var sGeometry = sResponse.features[0].geometry.coordinates;
            m.options.nearestVertex = sResponse.features[0].properties.id;
            console.log(sResponse.features[0].properties.id)
            m.setLatLng(new L.LatLng(sGeometry[1],sGeometry[0]));
            await this.regenPaths(m.options.index,false,false);

            // if start or end marker then update values in sidebar
            if (idx == 0 || idx == this.markerlist.length - 1) {
                this.updatePathMarkersSideBar(m, idx);
            }

            console.log("Re-Enabled Dragging");
            m.dragging.enable();
        });

        if(!isStartOrEnd) {
            m.on('dblclick', async (event) => {
                var idx = m.options.index;
                await this.removePathMarker(idx);
                await this.regenPaths(idx,true,false);
            });
        }
        

        return m;
    }

    async addPathMarker(pathIndex,pos,isStartOrEnd,customIcon) {
        var marker = await this.makeMarker(pathIndex,pos,isStartOrEnd,customIcon);
        console.log('hello 1')
        this.markerlist.splice(pathIndex, 0, marker);
        //change index of all future markers
        for (let i = pathIndex; i < this.markerlist.length; i++) {
            this.markerSetIndex(this.markerlist[i], i);
        }
        await this.regenPaths(marker.options.index,true,true);
        console.log('Add path')
    }

    async removePathMarker(pathIndex) {
        if (pathIndex >= 0 && pathIndex < this.markerlist.length) {
            const removedMarker = this.markerlist.splice(pathIndex, 1)[0];
            removedMarker.remove();
            for (let i = pathIndex; i < this.markerlist.length; i++) {
                this.markerSetIndex(this.markerlist[i], i);
            }
            return removedMarker;
        } else {
            console.log("Invalid pathIndex");
        }
    }

    //
    markerSetIndex(marker, idx) {
        marker.options.index = idx;
    }


    // Update the start and end marker locations on sidebar whenever they are moved
    updatePathMarkersSideBar(m, idx) {
        if (idx == 0) { // start marker
            const startSpan = document.getElementById("start");
            const startSpanTextNode = startSpan.querySelector("p");

            startSpan.classList.add("active");
            startSpanTextNode.innerText = m.options.nearestVertex;  // FIX ME - change to name of feature 
    
        } else if (idx == this.markerlist.length - 1) { // end marker
            const endSpan = document.getElementById("end");
            const endSpanTextNode = endSpan.querySelector("p");

            endSpan.classList.add("active");
            endSpanTextNode.innerText = m.options.nearestVertex;  // FIX ME - change to name of feature 
        }
        
        const selectBtnContainer = document.querySelectorAll(".selectBtnContainer");
        const lastRoutedDayContainer = selectBtnContainer[selectBtnContainer.length - 1]
        
        const selectButtonSpans = lastRoutedDayContainer.querySelectorAll("span");
        console.log(selectButtonSpans)
        var endPointsSelected = true;
        selectButtonSpans.forEach((span) => {
            if (!span.classList.contains("active")) {
                endPointsSelected  = false; // not all end points have been selected
            }
        });

        if (endPointsSelected) {
            // append the route container after the select start container
            const selectBtnContainer = document.querySelector(".selectBtnContainer"); // get the select btn parent 
            console.log(selectBtnContainer)
            

            const selectStartContainer = selectBtnContainer.firstChild; // get the select start container
            console.log(selectStartContainer)
            
            let routePathContainer = document.querySelector(".route-path-container")
            // if (routePathContainer) {
            //     routePathContainer.remove()
            // }

            routePathContainer = this.createRoutePathContainer()
            // selectStartContainer.after(routePathContainer, selectStartContainer)

            selectBtnContainer.after(routePathContainer, selectStartContainer); // insert route path ctn after select start container
        }

    }

    createRoutePathContainer() {
        const routePathContainer = document.createElement("div");
        const routePathSpan = document.createElement("span");
        const routePathImg = document.createElement("img");
        const routePathText = document.createElement("p");

        routePathContainer.classList.add("route-path-container");
        routePathText.innerText = "Show path";
        routePathImg.src = "../../src/frontend/assets/expand-all.svg";
        routePathSpan.append(routePathImg);
        routePathSpan.append(routePathText);
        routePathContainer.append(routePathSpan);

        routePathContainer.addEventListener("click", async () => { // on click append the route directions
            const pathTable = routePathContainer.querySelector(".path-table");

            if (pathTable) { // if path container exists
                pathTable.style.display === "block" ? pathTable.style.display = "none" :  pathTable.style.display = "block"
            } else { // create path container
                const data = await this.createDirectionsFromPath(this.pathDatalist);
                const pathTable = document.createElement("table")
                const pathTableHeaderRow = document.createElement("tr")
                const pathTypeHeader = document.createElement("th")
                const pathDistanceHeader = document.createElement("th")

                routePathContainer.classList.add("active");
                pathTable.classList.add('path-table')
                pathTypeHeader.innerHTML = "Portage/Lake"
                pathDistanceHeader.innerHTML = "Distance (m)"

                pathTableHeaderRow.appendChild(pathTypeHeader)
                pathTableHeaderRow.appendChild(pathDistanceHeader)
                pathTable.appendChild(pathTableHeaderRow)
                
                data.forEach((item, idx) => {
                    const pathTableRow = document.createElement("tr")
                    const pathTypeData = document.createElement("td")
                    const pathDistData = document.createElement("td")

                    pathTableRow.classList.add('path-row')
                    pathTypeData.innerHTML = `${item.name}`;
                    pathDistData.innerHTML = `${item.distance}`;

                    pathTableRow.appendChild(pathTypeData)
                    pathTableRow.appendChild(pathDistData)
                    pathTable.appendChild(pathTableRow)
                })
                routePathContainer.appendChild(pathTable);
            }              
        })
        return routePathContainer
    }


    // Helper function to split a layer into individual features by subtype
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

    getMarkerLength() {
        return this.markerlist.length
    }
}
