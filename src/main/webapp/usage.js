let latlngUser;
let latlngH;
let hLayer;
let coordinate;
let radius;
let hArray= [];
let hCompelte = [];
let ospedalePiuVicino;
let osrID = ('5b3ce3597851110001cf6248799a998e587748709bc8404b32f5bf5c');

//Carico la mappa e la visualizzo
const map = L.map('map').setView([41.9, 12.6], 6);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        maxZoom: 15,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

//Dopodichè mi localizza automaticamente
map.locate({setView: true, maxZoom: 11, timeout: 30000});
map.on('locationfound', onLocationFound);
map.on('locationerror', onLocationError);

//Gestisco i botttoni nel header
document.getElementById('near').addEventListener('click', function() {loadMapH();$('#loader').show();});
document.getElementById('zoomOutBtn').addEventListener('click', function() {map.zoomOut();});
document.getElementById('zoomInBtn').addEventListener('click', function() {map.zoomIn();});

//Carico la stringa da far uscire nel popUp degli ospedali nel raggio
function featureString(feature)
{
    return "<b>" + feature.properties.Nome + "</b>"
        + "<br><br><b>Comune</b>: " + feature.properties.Comune;
}

//Carico il geojson e carico gli ospedali più vicini all'utente nel raggio di 25km
//se si fa click sul marker esce il popup
function loadMapH()
{
    const url = "hmap.geojson";

    $.getJSON(url, function (data)
    {
        hLayer = L.geoJSON(data,
            {
                onEachFeature: function (feature, layer)
                {
                  coordinate = layer.getLatLng();
                  layer.bindPopup(featureString(feature));
                },
                filter: function (feature, marker)
                {
                    latlngH = [feature.geometry.coordinates[1], feature.geometry.coordinates[0]];
                    return map.distance(latlngH, latlngUser)<25000;
                },
                filter: function (feature, marker)
                {
                    latlngH = L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
                    const distance = latlngUser.distanceTo(latlngH);
                    return distance < 25000;
                },
                onEachFeature: function (feature, layer)
                {
                    let latLngH = layer.getLatLng();
                    layer.bindPopup(featureString(feature));
                    hArray.push([latLngH.lat, latLngH.lng]);
                    hCompelte.push({coordinate: [latLngH.lat, latLngH.lng], nome: feature.properties.Nome, comune: feature.properties.Comune});
                }
            }).addTo(map);
    });

    setTimeout(drawRoadRoute,3000);
}

//Icona rossa per la posizione dell'utente perchè è più bella
let redIcon = new L.Icon(
    {
        iconUrl: 'img/marker-icon-2x-red.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
});

//Icona viola per identificare l'ospedale più vicino perchè è più bello
let violetIcon = new L.Icon(
    {
        iconUrl: 'img/marker-icon-2x-violet.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
});

// Aggiungo un marker rosso alla posizione dell'utente
function onLocationFound(e)
{
    const marker = L.marker(e.latlng, {icon: redIcon}).addTo(map);
    latlngUser = e.latlng;
    radius = e.accuracy;

    marker.bindPopup("Sei qui!").openPopup();
    L.circle(latlngUser,
        {
            color: "yellow",
            radius: radius
        }).addTo(map);
}

// Gestisco il caso in cui la geolocalizzazione fallisce
function onLocationError(e) {
    alert(e.message);
    document.getElementById("text").textContent =
        ('Ricorda che se non autorizzi l\'accesso alla posizione non potrai utilizzare il servizio di ricerca ospedale');
}

/*con questa funzione richiamo le API di OpenStreetRoute e calcolo la distanza stradale fra
le coordinate dell'utente e le coordinate degli ospedali nel raggio*/
function drawRoadRoute()
{
    let ospedaliDistanze = [];
    hArray.forEach(function(coordinate)
    {
        // Converte le coordinate degli ospedali in oggetti Latlng
        let latlngOspedale = L.latLng(coordinate[0], coordinate[1]);

        // Chiama l'API di routing OpenStreetRoute per calcolare la distanza stradale
        let url = 'https://api.openrouteservice.org/v2/directions/driving-car?api_key='+ osrID + '&start='
            + latlngUser.lng + ',' + latlngUser.lat + '&end=' + latlngOspedale.lng + ',' + latlngOspedale.lat;

        $.getJSON(url, function(data)
        {
            // Aggiungi la distanza stradale all'array degli ospedali e delle distanze
            ospedaliDistanze.push({coordinate: coordinate, distanza: data.features[0].properties.segments[0].distance});

            // Se ha calcolato la distanza per tutti gli ospedali, seleziona quello più vicino e visualizza a schermo
            if (ospedaliDistanze.length === hArray.length) {
                ospedalePiuVicino = ospedaliDistanze.reduce(function (prev, current)
                {
                    return (prev.distanza < current.distanza) ? prev : current;
                });
                map.flyTo([ospedalePiuVicino.coordinate[0], ospedalePiuVicino.coordinate[1]], 15,
                    {
                        animate: true,
                        duration: 3 // Durata dell'animazione in secondi
                    });
                $('#loader').hide();
                let markers = L.marker([ospedalePiuVicino.coordinate[0], ospedalePiuVicino.coordinate[1]], {icon: violetIcon}).addTo(map);
                document.getElementById("text").textContent = ('Nearest Hospital: ' + ospedalePiuVicino.distanza + ' meters');
                let popupContent = search(ospedalePiuVicino);

                markers.bindPopup(popupContent).openPopup();
            }
        });
    });

    setTimeout(openStreetRouteDraw, 2000);
}

/*con questa funzione una volta che ho la posizione dell'ospedale più vicino calcolo
il percorso strdale chiamando sempre le API di OpenStreetRoute e le visualizzo accanto alla mappa*/
function openStreetRouteDraw()
{
    var request = new XMLHttpRequest();

    request.open('POST', "https://api.openrouteservice.org/v2/directions/driving-car/geojson");

    request.setRequestHeader('Accept', 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8');
    request.setRequestHeader('Content-Type', 'application/json');
    request.setRequestHeader('Authorization', osrID);

    request.onreadystatechange = function()
    {
        if (this.readyState === 4 && this.status === 200)
        {
            //console.log('Body:', this.responseText);
            let response = JSON.parse(this.responseText);

            // Mostra le indicazioni stradali nella pagina HTML
            const instructionsContainer = document.getElementById("control");
            control.innerHTML = "";

            const steps = response.features[0].properties.segments[0].steps;
            steps.forEach((step, index) =>
            {
                const instructionElement = document.createElement("p");
                instructionElement.textContent = `${index + 1}. ${step.instruction}`;
                instructionsContainer.appendChild(instructionElement);
            });
            const routeLayer = L.geoJSON(response).addTo(map);
        }
    };

    var body = JSON.stringify({
        "coordinates":
            [
            [latlngUser.lng, latlngUser.lat],
            [ospedalePiuVicino.coordinate[1], ospedalePiuVicino.coordinate[0]]
            ]
    });
    request.send(body);
}

//trovate le coordinate dell'ospedale più vicino mi trovo il nome dell'ospedale e il comune
function search()
{
    let found;
    for(let i = 0; i<hCompelte.length; i++)
    {
        if(ospedalePiuVicino.coordinate[0] === hCompelte[i].coordinate[0] && ospedalePiuVicino.coordinate[1] === hCompelte[i].coordinate[1])
        {
            found = [hCompelte[i].nome, hCompelte[i].comune].join();
        }
    }
/*dato che non sempre c'è il nome dell'ospedale e come primo carattere c'è una virgola
* che è proprio brutta la levo*/

    if (found.charAt(0) === ',')
    {
        return found.slice(1);
    }
    return found;
}