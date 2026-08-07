"use client";
import {useState} from "react"; import {Home,Heart,Sparkles,Users,User,Search,Bell,TrendingDown,ArrowRight} from "lucide-react";
const wishes=[["Oakley Sutro",119,115,30,94,"🕶️"],["Sony WH-1000XM6",329,320,15,91,"🎧"],["MacBook Pro 14",2049,1999,11,87,"💻"]];
export default function Page(){const[tab,setTab]=useState("Home");return <main className="shell">
<header><div><div className="logo">WANT<span>.</span></div><small>AI SHOPPING AGENT</small></div><div className="actions"><button><Search/></button><button><Bell/></button></div></header>
<section className="hero"><label><Sparkles size={14}/> YOUR SHOPPING COPILOT</label><h1>What do you <em>want?</em></h1><p>Tell WANT. what you're looking for. AI identifies the exact product, tracks the market and finds the right moment to buy.</p><div className="ask"><input placeholder='Try “I want Oakley sunglasses”'/><button><ArrowRight/></button></div></section>
<section className="stats"><div><b>3</b><span>Wishes tracked</span></div><div><b>0</b><span>Targets hit</span></div><div><b>€184</b><span>Potential savings</span></div></section>
<div className="title"><b>● AI TOP PICKS</b><span>View all</span></div><section className="cards">{wishes.map((w:any,i)=><article key={w[0]}><i>#{i+1}</i><strong>{w[5]}</strong><div><b>{w[0]}</b><small>Target €{w[2]} · <u><TrendingDown size={12}/>{w[3]}%</u></small></div><aside><b>€{w[1]}</b><small>WANT SCORE {w[4]}</small></aside></article>)}</section>
<section className="insight"><div><label><Sparkles size={13}/> AI INSIGHT</label><h2>Oakley is close to your target.</h2><p>Current price is only €4 above target and near its 90-day low.</p></div><button>Check deals <ArrowRight size={15}/></button></section>
<div className="title"><b>COMMUNITY TRENDING</b><span>Explore</span></div><section className="community"><b>👤 👤 👤</b><div><b>1,284 people want this</b><small>Trending products & shared deals</small></div><button>+</button></section>
<nav>{[["Home",Home],["Wishes",Heart],["AI",Sparkles],["Community",Users],["Profile",User]].map(([n,I]:any)=><button className={tab===n?"active":""} onClick={()=>setTab(n)} key={n}><I/><span>{n}</span></button>)}</nav>
</main>}