import axios from 'axios';
const query = `
    [out:json][timeout:15];
    (
      node["amenity"~"restaurant|cafe|bar|bistro|fast_food|pub"](around:500,40.4168,-3.7038);
      way["amenity"~"restaurant|cafe|bar|bistro|fast_food|pub"](around:500,40.4168,-3.7038);
    );
    out center tags;`;

axios.post('https://overpass-api.de/api/interpreter', query, {
  headers: { 
    'Content-Type': 'text/plain',
    'User-Agent': 'trIAvel/1.0 (travel-planner-app)'
  },
  timeout: 15000
}).then(res => {
  console.log("Success! Found", res.data.elements?.length);
}).catch(err => {
  console.error("Error", err.response?.status, err.response?.data);
});
