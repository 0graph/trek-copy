import ClusterGroup from "./clusterGroup.js";
import { mapSettings } from "./mapSettings.js";

export class Map {
    constructor(park) {
        this.map;
        this.park;
        this.sidebar;
        this.searchLayer;
        this.MapSettings = new mapSettings();
        this.clusterGroup = new ClusterGroup(this.MapSettings);

        this.sourceID = 38509;
        this.targetID = 5742; //change to a list of target IDs
        this.directionMarkers = [];
        this.srt_view = [45.80, -78.40];
        this.SW = [45.00, -80.00];
        this.NE = [46.50 , -77.00];
        this.bounds;
        this.MapSettings = new mapSettings();
    }

    initMapDiv() {
        this.sidebar = L.control.sidebar('sidebar', {
            position: 'left'
        });
        
        this.sidebar.addTo(this.map);    

    }
  
    initMap(park) {
        this.park = park;
        
        this.map = L.map("map", {
            center: this.srt_view,
            zoom: 9, //set the zoom level
            minZoom: 8,
            maxZoom: 16,
           maxBounds: L.latLngBounds(this.SW, this.NE)
        });

        this.initMapDiv(); // show map in container
        // L.control.bigImage({position: 'bottomright'}).addTo(this.map); // add print control 
        this.clusterGroup.mapLayerGroup.addTo(this.map); // add layer group to map
        this.map.setView(this.srt_view, 9); // set map view to specified coordinates and zoom level
        // addStartMarkers(this); // add route planning markers
    }

    showFeatureIcon(feature) {
        this.clusterGroup.showLayer(feature);
    }
    
    hideFeatureIcon(feature) {
        this.clusterGroup.hideLayer(feature);
    }


    showSideBar() {
        this.sidebar.open("home");
    }

    async addStartMarkers(){
        
        var canoe_iconS = L.icon({
            iconUrl: "assets/start-pin.svg",
            iconSize:     [38, 95], // size of the icon
        });
        var canoe_iconE = L.icon({
            iconUrl: "assets/end-pin.svg",
            iconSize:     [38, 95], // size of the icon
        });
    
        await this.clusterGroup.addPathMarker(0,{lat:45.844645909959816 , lng:-78.3995533866199},true,canoe_iconS);
        await this.clusterGroup.addPathMarker(1,{lat:45.844645909959816 , lng:-78.5995533866199},true,canoe_iconE);

        console.log('Add pin')
        
    }

    async addNextMarker(day) {
        var canoe_iconS = L.icon({
            iconUrl: "assets/start-pin.svg",
            iconSize:     [38, 95], // size of the icon
        });

        const numMarkers = this.clusterGroup.getMarkerLength()
        console.log(numMarkers)
        await this.clusterGroup.addPathMarker(numMarkers, {lat:45.844645909959816 , lng:-78.3995533866199},true,canoe_iconS);
    }

    getStartEndMarkers() {
        const endPoints = this.clusterGroup.getPathEndPoints();
        console.log(endPoints);
    }

    // async addDirectionsToSidebar(pdata) {
    //     for(let marker of this.directionMarkers) {
    //         marker.remove();
    //     }
    //     this.directionMarkers = [];

    //     const data = await this.clusterGroup.createDirectionsFromPath(pdata);
        
    //     const outputDiv = document.getElementById('directions-table');
    //     outputDiv.innerHTML = '';
    
    //     data.forEach((item, index) => {
    //         const liElement = document.createElement('div');
    //         liElement.classList.add('table-row');
    
    //         liElement.innerHTML = `
    //             <div class="table-cell ...">${item.name}</div>
    //             <div class="table-cell ...">${item.distance}</div>`;
    
    //         outputDiv.appendChild(liElement);

    //         if(this.MapSettings.dispdir) {
    //             var marker = L.marker([item.pos[1], item.pos[0]]).addTo(this.map);
    //             marker.bindPopup(`${item.name}\nType: ${item.type}`);
    //             this.directionMarkers.push( marker );
    //         }
    //     });
    // }

    disableMapInteraction() {
        this.map.dragging.disable();
        this.map.touchZoom.disable();
        this.map.doubleClickZoom.disable();
        this.map.scrollWheelZoom.disable();
        this.map.boxZoom.disable();
        this.map.keyboard.disable();
        document.getElementById('map').style.cursor='default';
    }

    enableMapInteraction() {
        this.map.dragging.enable();
        this.map.touchZoom.enable();
        this.map.doubleClickZoom.enable();
        this.map.scrollWheelZoom.enable();
        this.map.boxZoom.enable();
        this.map.keyboard.enable();
        document.getElementById('map').style.cursor='grab';
    }
    // extract route information into dictonary for PDF
    async getRouteInfo() {
        // this.map.clusterGroup.addDirectionsToSidebar(map.clusterGroup.pathDatalist);

        const data = await this.clusterGroup.createDirectionsFromPath(this.clusterGroup.pathDatalist);
        
        const routeInfo = {};
        routeInfo.route = "";
        routeInfo.distance = "";
        data.forEach((item, index) => {
            routeInfo["route"] = routeInfo["route"] + item.name + "\n";
            routeInfo["distances"] = routeInfo["distances"] + "0m" + "\n";
        });

        // console.log(routeInfo);
        
        // routeInfo.route = "A route";
        routeInfo.crew = "Thomas Adam Gryphon";
        // routeInfo.distances = "1000, 231, 500, 564";
        routeInfo.portages = "943, 321, 432, 50";
        routeInfo.totalPortage = "1500m";
        routeInfo.totalCanoe = "5000m";

        return routeInfo;
    }

    // may have to create a user class containing user information
    getTripDetails() {
        const details = {};
        const date = new Date();

        details["park"] = this.park;
        details["year"] = date.getFullYear();
        details["type"] = "canoe";
        details["dates"] = {
            "July 30": "Big Crow Lake",
            "July 31": "Lake La Muir",
            "Aug 1": "Burntroot lake",
            "Aug 2-3": "Big Trout Lake",
            "Aug 4": "Happy Isle Lake",
        }
        details["crew"] = {
            "Boat 1": {
                "Thomas Phan": "Bow",
                "Griffin Baird": "Midship",
                "Adam Booth": "Stern",
            },

            "Boat 2": {
                "Adam Booth": "Bow",
                "Griffin Baird": "Midship",
                "Thomas Phan": "Stern",
            },


            "Boat 3": {
                "Adam Booth": "Bow",
                "Griffin Baird": "Midship",
                "Thomas Phan": "Stern",
            },
        }

        details["distances"] = {
            totalApproxCanoeKm: "67.5",
            totalPortageMetre: "10,860",
            bydate: [
                {
                    date: "July 30 (Sun)",
                    targetLake: "Big Crow",
                    approxCanoeKm: "10.7",
                    totalPortageMetre: "1,275",
                    individualPortageMetre: "310, 965"
                },
                {
                    date: "July 31 (Mon)",
                    targetLake: "La Muir",
                    approxCanoeKm: "11.5",
                    totalPortageMetre: "4,435",
                    individualPortageMetre: "3750, 865"
                },
                {
                    date: "Aug 1 (Tues)",
                    targetLake: "Burnt Root",
                    approxCanoeKm: "10.7",
                    totalPortageMetre: "4,435",
                    individualPortageMetre: "375"
                },
                {
                    date: "Aug 2 (Wed)",
                    targetLake: "Big Trout",
                    approxCanoeKm: "10.7",
                    totalPortageMetre: "4,435",
                    individualPortageMetre: "75, 40, 300"
                },
                {
                    date: "Aug 4 (Fri)",
                    targetLake: "Happy Isle",
                    approxCanoeKm: "10.7",
                    totalPortageMetre: "4,435",
                    individualPortageMetre: "310, 965"
                },
                {
                    date: "Aug 5 (Sat)",
                    targetLake: "Access Point 5",
                    approxCanoeKm: "10.7",
                    totalPortageMetre: "4,435",
                    individualPortageMetre: "310, 965"
                }
            ]
        }
        return details;
    }
}
export default Map;
