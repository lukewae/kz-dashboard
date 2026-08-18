"use client";
import { Search as SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
export function Search() { const [value,setValue]=useState(""); const router=useRouter(); function submit(e:FormEvent){e.preventDefault();const q=value.trim();if(q)router.push(`/?q=${encodeURIComponent(q)}`)} return <form className="search" onSubmit={submit}><label className="sr-only" htmlFor="map-search">Search map names</label><input id="map-search" value={value} onChange={e=>setValue(e.target.value)} placeholder="Search an approved map…"/><button className="btn" type="submit"><SearchIcon size={16}/> Search</button></form> }
