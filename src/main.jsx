import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, Bookmark, Camera, Check, Compass, Grid2X2, Heart, ImagePlus, MapPin, Plus, Search, Sparkles, X } from 'lucide-react';
import './styles.css';

const photo = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=85`;
const heroImage = photo('photo-1553062407-98eeb64c6a62');
const categories = ['All items','Bags','Electronics','Bottles','Accessories','Other'];
const locations = ['All locations','Student Center','Library','Engineering Hall'];
const dateLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'});
async function api(path,options={}){
  let response;
  try{response=await fetch(`/api${path}`,options);}catch(error){if(error.name==='AbortError')throw error;throw new Error('Cannot reach the backend. Start the API on port 8000 and try again.');}
  let data;try{data=await response.json();}catch{throw new Error('The backend did not return an API response. Check that the API is running on port 8000.');}
  if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:Array.isArray(data.detail)?data.detail.map(e=>e.msg).join(' '):'The request could not be completed. Please try again.');
  return data;
}
const readStored = (key, fallback) => {try {return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}};

function App(){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [apiError,setApiError]=useState('');
  const [searchFile,setSearchFile]=useState(null);
  const [activeImage,setActiveImage]=useState(null);
  const [refresh,setRefresh]=useState(0);
  const [saved,setSaved]=useState(()=>readStored('foundit-saved',[]));
  const [tab,setTab]=useState('browse');
  const [query,setQuery]=useState('');
  const [search,setSearch]=useState('');
  const [category,setCategory]=useState('All items');
  const [location,setLocation]=useState('All locations');
  const [sort,setSort]=useState('newest');
  const [modal,setModal]=useState(null);
  const [toast,setToast]=useState('');
  const [queryImage,setQueryImage]=useState(null);
  const imageInput=useRef(null);
  const browseRef=useRef(null);
  useEffect(()=>{try{localStorage.setItem('foundit-saved',JSON.stringify(saved));}catch{}},[saved]);
  useEffect(()=>{if(toast){const timer=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(timer);}},[toast]);
  useEffect(()=>{if(!modal)return;const handler=e=>{if(e.key==='Escape')setModal(null);};document.addEventListener('keydown',handler);const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',handler);document.body.style.overflow=old;};},[modal]);
  const toggleSave=id=>setSaved(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
  useEffect(()=>{
    let cancelled=false;
    const controller=new AbortController();
    const load=async()=>{
      setLoading(true);setApiError('');
      try{
        let results=[];
        const filters={};
        if(category!=='All items')filters.category=category;
        if(location!=='All locations')filters.location=location;
        if(activeImage){
          const body=new FormData();body.append('image',activeImage);
          Object.entries(filters).forEach(([key,value])=>body.append(key,value));
          body.append('limit','100');
          results=(await api('/search/image',{method:'POST',body,signal:controller.signal})).items;
        }else if(search){
          results=(await api('/search/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:search,limit:100,...filters}),signal:controller.signal})).items;
        }else{
          let offset=null;
          do{
            const params=new URLSearchParams({...filters,limit:'100'});
            if(offset)params.set('offset',offset);
            const page=await api(`/items?${params}`,{signal:controller.signal});
            results.push(...page.items);offset=page.next_offset;
          }while(offset);
        }
        if(!cancelled)setItems(results);
      }catch(error){if(!cancelled){setApiError(error.message);setItems([]);}}
      finally{if(!cancelled)setLoading(false);}
    };
    load();return()=>{cancelled=true;controller.abort();};
  },[search,activeImage,category,location,refresh]);
  const filtered=items.filter(item=>tab!=='saved'||saved.includes(item.id)).sort((a,b)=>(search||activeImage)?(b.score??0)-(a.score??0):sort==='newest'?b.date.localeCompare(a.date):a.date.localeCompare(b.date));
  const clearSearch=()=>{setSearch('');setQuery('');setSearchFile(null);setActiveImage(null);setQueryImage(null);};
  const submitSearch=e=>{e.preventDefault();setSearch(searchFile?'':query.trim());setActiveImage(searchFile);setRefresh(v=>v+1);setTab('browse');browseRef.current?.scrollIntoView({behavior:'smooth',block:'start'});};
  const chooseImage=e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){setToast('Choose an image file.');return;}if(file.size>8*1024*1024){setToast('Choose a photo smaller than 8 MB.');return;}const reader=new FileReader();reader.onload=()=>{setQueryImage(reader.result);setSearchFile(file);setToast('Photo selected. Press Find matches to search by appearance.');};reader.readAsDataURL(file);e.target.value='';};
  const addItem=async item=>{
    const body=new FormData();
    body.append('image',await (await fetch(item.image)).blob(),'item.jpg');
    for(const key of ['title','description','category','location'])body.append(key,item[key]);
    body.append('found_date',item.date);
    await api('/items',{method:'POST',body});
    setModal(null);setTab('browse');setCategory('All items');setLocation('All locations');clearSearch();setRefresh(v=>v+1);
    setToast('Item posted. Its photo is now searchable.');
    setTimeout(()=>browseRef.current?.scrollIntoView({behavior:'smooth'}),100);
  };
  return <>
    <header className="header"><a href="#" className="brand" aria-label="FoundIt home" onClick={()=>setTab('browse')}><span className="brand-mark"><Compass size={24}/></span>foundit<span className="brand-dot">.</span></a><nav aria-label="Main navigation"><button className={tab==='browse'?'nav-link active':'nav-link'} onClick={()=>{setTab('browse');browseRef.current?.scrollIntoView({behavior:'smooth'});}}>Browse items</button><button className={tab==='saved'?'nav-link active':'nav-link'} onClick={()=>{setTab('saved');browseRef.current?.scrollIntoView({behavior:'smooth'});}}>Saved <span className="saved-count">{saved.length}</span></button><button className="nav-link how-link" onClick={()=>setModal('how')}>How it works</button></nav><button className="button primary header-post" onClick={()=>setModal('post')}><Plus size={17}/> Post a found item</button></header>
    <main>
    <section className="hero">
      <div className="hero-copy"><div className="eyebrow"><span className="status-dot"/> SMALL CAMPUS. GOOD PEOPLE.</div><h1>Lost happens.<br/><span>Found feels better.</span></h1><p>Your favorite things have a way of finding their way back.<br className="desktop-break"/> Let’s help them along.</p><div className="hero-actions"><a className="button primary" href="#items">Find my thing <ArrowRight size={17}/></a><button className="text-button" onClick={()=>setModal('post')}>Found something? <ArrowUpRight/></button></div><div className="community-note"><span className="tiny-avatars"><img src="https://i.pravatar.cc/64?img=47" alt=""/><img src="https://i.pravatar.cc/64?img=12" alt=""/><img src="https://i.pravatar.cc/64?img=49" alt=""/></span><span>A little help from your campus community.</span></div></div>
      <div className="hero-art" aria-label="Illustration of belongings finding their way home"><div className="art-grid"/><div className="orbit orbit-one"/><div className="orbit orbit-two"/><span className="art-spark spark-one">✳</span><span className="art-spark spark-two">+</span><div className="floating-label"><span className="round-check"><Check size={13}/></span> Back where it belongs.</div><div className="polaroid"><div className="polaroid-photo"><img src={heroImage} alt="Black backpack"/></div><div className="polaroid-caption"><span>Someone’s everyday essential.</span><Heart size={16}/></div><span className="tape"/></div><div className="mini-note"><MapPin size={17}/><div>Found around campus<span>One less thing to worry about.</span></div></div><span className="art-caption">GOOD THINGS COME BACK AROUND ↗</span></div>
    </section>
    <section className="search-section" aria-label="Find an item"><div className="search-heading"><span><Sparkles size={16}/> A description. A photo. A place to start.</span><span className="demo-pill">VECTOR SEARCH</span></div><form className="search-box" onSubmit={submitSearch}><Search size={22}/><input aria-label="Describe your lost item" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Blue water bottle? Black backpack? Tell us what’s missing…"/><button type="button" className="photo-search" onClick={()=>imageInput.current.click()}><Camera size={19}/><span>Use a photo</span></button><button className="button primary search-submit" type="submit">Find matches <ArrowRight size={17}/></button><input ref={imageInput} type="file" accept="image/*" hidden onChange={chooseImage}/></form>{queryImage?<div className="query-image"><img src={queryImage} alt="Selected search photo"/><div><strong>Your search photo</strong><span>Ready for visual search. Photo search takes priority over text.</span></div><button className="icon-button" aria-label="Remove search photo" onClick={()=>{setQueryImage(null);setSearchFile(null);setActiveImage(null);}}><X size={17}/></button></div>:<p className="search-hint">Search by appearance with CLIP + Qdrant. Results are possible matches, not confirmed identities.</p>}</section>
    <section className="items-section" id="items" ref={browseRef}><div className="section-heading"><div className="section-title"><span className="eyebrow">A SECOND LOOK COULD BE ALL IT TAKES</span><h2>{tab==='saved'?'Your saved finds':'Around campus'}<span className="item-count">{filtered.length}</span></h2><p>{tab==='saved'?'Keep an eye on the things that look familiar.':'Found things, waiting for familiar faces.'}</p></div><label className="sort-label" style={(search||activeImage)?{visibility:'hidden'}:{}}>Sort by <select aria-label="Sort items" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></div><div className="filters"><div className="category-tabs" aria-label="Item categories">{categories.map(c=><button key={c} className={`category ${category===c?'selected':''}`} onClick={()=>setCategory(c)}>{c==='All items'&&<Grid2X2 size={14}/>} {c}</button>)}</div><label className="location-filter"><MapPin size={15}/><select aria-label="Filter by location" value={location} onChange={e=>setLocation(e.target.value)}>{locations.map(l=><option key={l}>{l}</option>)}</select></label></div>{(search||activeImage)&&<div className="search-summary">{activeImage?'Results for your photo':`Results for “${search}”`} <button onClick={clearSearch}>Clear search <X size={13}/></button></div>}
    {loading?<div className="empty-state" role="status"><Sparkles size={32}/><h3>{search||activeImage?'Looking for possible matches…':'Loading the board…'}</h3><p>{search||activeImage?'The first search may take longer while CLIP loads.':'Getting found items from Qdrant.'}</p></div>:apiError?<div className="empty-state" role="alert"><h3>Couldn’t load items</h3><p>{apiError}</p><button className="button secondary" onClick={()=>setRefresh(v=>v+1)}>Try again</button></div>:filtered.length?<div className="item-grid">{filtered.map(item=><article className="item-card" key={item.id}><div className="card-photo"><button className="image-open" onClick={()=>setModal(item)} aria-label={`View ${item.title}`}><img src={item.image} alt={item.title} loading="lazy" onError={e=>{e.target.style.visibility='hidden';e.target.parentElement.classList.add('image-failed');}}/></button><span className="found-badge"><span/>FOUND</span><button className={`save-button ${saved.includes(item.id)?'is-saved':''}`} aria-label={`${saved.includes(item.id)?'Unsave':'Save'} ${item.title}`} aria-pressed={saved.includes(item.id)} onClick={()=>toggleSave(item.id)}><Bookmark size={17} fill={saved.includes(item.id)?'currentColor':'none'}/></button><span className="photo-category">{item.category}</span></div><div className="card-info"><div className="card-meta"><span><MapPin size={13}/>{item.location}</span><time dateTime={item.date}>{dateLabel(item.date)}</time></div><button className="card-title" onClick={()=>setModal(item)}>{item.title}<ArrowRight size={16}/></button><p>{item.description}</p></div></article>)}</div>:<div className="empty-state"><Search size={32}/><h3>{tab==='saved'?'No saved items here yet':'Nothing here just yet'}</h3><p>{tab==='saved'?'Tap the bookmark on an item to keep it here.':'Try another description, category, or location.'}</p><button className="button secondary" onClick={()=>{setCategory('All items');setLocation('All locations');clearSearch();setTab('browse');}}>Browse all items</button></div>}
    <div className="board-note"><span className="status-dot"/> Photos and listings are saved on the backend. Bookmarks stay in this browser.</div></section>
    <section className="kindness-banner"><div className="banner-icon"><Heart size={28}/></div><div><h2>Found something? Make someone’s day.</h2><p>A quick photo could turn a bad day around.</p></div><button className="button primary" onClick={()=>setModal('post')}>Post a found item <Plus size={17}/></button></section>
    </main><footer><a href="#" className="brand"><span className="brand-mark"><Compass size={20}/></span>foundit<span className="brand-dot">.</span></a><span>Less lost. More found.</span><span className="footer-credit">Made for campus, with care. <Heart size={12}/></span></footer>
    {modal&&<Dialog onClose={()=>setModal(null)}>{modal==='post'?<PostForm onSubmit={addItem}/>:modal==='how'?<><span className="modal-eyebrow">A LITTLE HELP GOES A LONG WAY</span><h2>Good things find their way back.</h2><div className="how-steps">{[[Camera,'Spot it. Snap it.','Found something? Add a photo and tell us where you found it.'],[Search,'Take a look around.','Browse the board or search descriptions. Save anything that looks familiar.'],[MapPin,'Bring it back home.','Check the listing’s location and ask the building’s service desk about your item.']].map(([Icon,title,body],i)=><div key={title}><span className="step-number">0{i+1}</span><div><h3><Icon size={18}/>{title}</h3><p>{body}</p></div></div>)}</div><p className="modal-note">Photos and search queries are encoded by CLIP and compared in Qdrant. Results show visual similarity. Pickup coordination is not connected yet.</p></>:<><div className="detail-image"><img src={modal.image} alt={modal.title}/></div><span className="modal-eyebrow">FOUND · {modal.category.toUpperCase()}</span><h2>{modal.title}</h2><div className="detail-meta"><span><MapPin size={16}/>{modal.location}</span><span>{dateLabel(modal.date)}</span></div><p className="detail-description">{modal.description}</p><div className="handoff-note"><MapPin size={20}/><div><strong>Think this might be yours?</strong><p>{'Use the location and description to identify your item. This app does not yet provide verified pickup or messaging.'}</p></div></div><button className="button primary full-width" onClick={()=>toggleSave(modal.id)}><Bookmark size={17}/>{saved.includes(modal.id)?'Remove from saved':'Save this item'}</button></>}</Dialog>}
    {toast&&<div className="toast" role="status"><Check size={18}/>{toast}<button className="icon-button" aria-label="Dismiss message" onClick={()=>setToast('')}><X size={16}/></button></div>}
  </>;
}
function ArrowUpRight(){return <ArrowRight size={15} style={{transform:'rotate(-35deg)'}}/>;}
function Dialog({children,onClose}){const dialog=useRef(null);useEffect(()=>{const previous=document.activeElement;dialog.current?.focus();return()=>previous?.focus();},[]);const trap=e=>{if(e.key!=='Tab')return;const nodes=[...dialog.current.querySelectorAll('button,input,select,textarea,a[href]')].filter(el=>!el.disabled&&el.offsetParent!==null);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}};return <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-label="FoundIt item information" ref={dialog} tabIndex={-1} onKeyDown={trap}><button className="modal-close icon-button" aria-label="Close dialog" onClick={onClose}><X size={21}/></button>{children}</section></div>;}
function PostForm({onSubmit}){const [image,setImage]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);const input=useRef(null);const processPhoto=file=>{if(!file)return;if(!file.type.startsWith('image/')){setError('Please choose an image file.');return;}if(file.size>8*1024*1024){setError('Please choose an image smaller than 8 MB.');return;}setBusy(true);setError('');const reader=new FileReader();reader.onerror=()=>{setBusy(false);setError('Could not read that image. Try another photo.');};reader.onload=()=>{const img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');const ratio=Math.min(1,1000/Math.max(img.width,img.height));canvas.width=img.width*ratio;canvas.height=img.height*ratio;canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);setImage(canvas.toDataURL('image/jpeg',0.8));setBusy(false);};img.onerror=()=>{setBusy(false);setError('This image format could not be opened. Try JPG or PNG.');};img.src=reader.result;};reader.readAsDataURL(file);};const submit=async e=>{e.preventDefault();if(!image){setError('Add a photo so someone can recognize their item.');return;}const data=new FormData(e.currentTarget);setBusy(true);setError('');try{await onSubmit({id:crypto.randomUUID(),title:data.get('title').trim(),description:data.get('description').trim(),location:data.get('location'),category:data.get('category'),date:data.get('date'),image,tags:''});}catch(error){setError(error.message);}finally{setBusy(false);}};return <><span className="modal-eyebrow">YOU FOUND IT. LET’S GET IT HOME.</span><h2>Post a found item</h2><p className="form-intro">A photo and a few details can make all the difference.</p><form className="post-form" onSubmit={submit}><button type="button" className={`upload-area ${image?'has-image':''}`} onClick={()=>input.current.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();processPhoto(e.dataTransfer.files[0]);}}>{image?<><img src={image} alt="Item photo preview"/><span>Click to change photo</span></>:<><ImagePlus size={29}/><strong>{busy?'Preparing photo…':'Add a photo of the item'}</strong><span>Click or drop an image · up to 8 MB</span></>}</button><input ref={input} hidden type="file" accept="image/*" onChange={e=>processPhoto(e.target.files[0])}/><label>What did you find?<input name="title" required maxLength={70} placeholder="e.g. Black backpack with a front pocket"/></label><div className="form-row"><label>Category<select name="category">{categories.slice(1).map(c=><option key={c}>{c}</option>)}</select></label><label>Found on<input name="date" type="date" required defaultValue={new Date().toLocaleDateString('en-CA')} max={new Date().toLocaleDateString('en-CA')}/></label></div><label>Where did you find it?<select name="location">{locations.slice(1).map(l=><option key={l}>{l}</option>)}</select></label><label>A few more details<textarea name="description" required maxLength={500} rows={3} placeholder="Describe the item and the spot where you found it. Leave out private details."/></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button primary full-width" disabled={busy} type="submit">{busy?'Saving and indexing…':'Post found item'} <ArrowRight size={17}/></button><p className="modal-note">Your photo is stored on the backend and indexed for text and image search. Avoid uploading private information.</p></form></>;}

createRoot(document.getElementById('root')).render(<App/>);
