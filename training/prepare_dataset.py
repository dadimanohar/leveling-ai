import argparse,hashlib,json,pathlib,re,urllib.parse
BAD=("spam","casino","piracy","malware","credential","password","private key","adult","phishing")
def clean(s):return re.sub(r"\s+"," ",str(s or "")).strip()
def allowed(url,allow):
    h=urllib.parse.urlparse(url).hostname or ""
    return (not allow) or any(h==a or h.endswith("."+a) for a in allow)
def quality(text,url):
    q=.55
    if len(text)>1200:q+=.15
    elif len(text)>400:q+=.08
    if url.startswith("https://"):q+=.08
    q-=min(.45,sum(x in text.lower() for x in BAD)*.12)
    if len(text.split())<100:q-=.1
    return max(0,min(1,round(q,3)))
ap=argparse.ArgumentParser();ap.add_argument("--input",required=True);ap.add_argument("--output",required=True);ap.add_argument("--config",required=True);a=ap.parse_args()
cfg=json.loads(pathlib.Path(a.config).read_text());allow=[str(x).lower() for x in cfg.get("sources_allowlist",[])];minq=float(cfg.get("min_quality_score",.72));out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True);seen=set();rows=[]
for f in pathlib.Path(a.input).rglob("*.jsonl"):
    for line in f.read_text(errors="ignore").splitlines():
        try:r=json.loads(line)
        except:continue
        t=clean(r.get("text",""));u=str(r.get("source_url",""))
        if len(t)<160 or not allowed(u,allow):continue
        q=quality(t,u);h=hashlib.sha256(t.encode()).hexdigest()
        if q<minq or h in seen:continue
        seen.add(h);rows.append({**r,"text":t,"quality":q,"sha256":h})
(pathlib.Path(a.output)/"curated.jsonl").write_text("\n".join(json.dumps(r,ensure_ascii=False) for r in rows)+"\n","utf8")
print(json.dumps({"curated_records":len(rows)}))
