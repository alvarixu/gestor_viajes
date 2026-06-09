import axios from 'axios';

async function test() { 
  try { 
    const res = await axios.post('https://overpass-api.de/api/interpreter', '[out:json][timeout:15];(node["amenity"~"restaurant|cafe|bar|bistro|fast_food|pub"](around:500,40.4168,-3.7038);way["amenity"~"restaurant|cafe|bar|bistro|fast_food|pub"](around:500,40.4168,-3.7038););out center tags;', {headers: {'Content-Type': 'text/plain', 'User-Agent': 'trIAvel/1.0'}}); 
    console.log('Elements:', res.data.elements?.length); 
    console.log(res.data.elements?.slice(0,5).map(e=>e.tags?.name)); 
  } catch(e) { 
    console.error(e.message); 
  } 
} 
test();
