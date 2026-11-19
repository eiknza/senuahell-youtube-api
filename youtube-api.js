(function(){
  const BASE=(window.YOUTUBE_API_BASE||"").replace(/\/$/,"");
  const CACHE_KEY="senuahell_youtube_backend_v1",CACHE_TIME=15*60*1000;
  async function load(force){
    if(!BASE||BASE.includes("YOUR-RENDER-SERVICE"))throw new Error("YouTube API sunucusu henüz bağlanmamış. Render adresini youtube-config.js dosyasına ekleyin.");
    if(!force){try{const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||"null");if(cached?.items?.length&&Date.now()-cached.time<CACHE_TIME)return cached.items}catch(_){}}
    const response=await fetch(BASE+"/api/youtube/videos",{cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||("API sunucusu hatası: "+response.status));if(!Array.isArray(data.items))throw new Error("YouTube sunucusundan geçersiz yanıt alındı.");try{localStorage.setItem(CACHE_KEY,JSON.stringify({time:Date.now(),items:data.items}))}catch(_){}return data.items;
  }
  window.SenuaYouTube={load,formatCount(value){if(value===null||value===undefined)return "Gizli";return new Intl.NumberFormat("tr-TR",{notation:Number(value)>=10000?"compact":"standard",maximumFractionDigits:1}).format(Number(value))}};
})();
