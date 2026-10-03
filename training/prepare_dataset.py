import argparse,hashlib,json,pathlib,re,urllib.parse
BAD=("spam","casino","piracy","malware","adult")
def clean(s): return re.sub(r"\s+"," ",str(s or "")).strip()
def quality(text,url):
    score=0.5
    if len(text)>400: score+=0.15
    if urllib.parse.urlparse(url).scheme in ("http","https"): score+=0.1
    if any(x in text.lower() for x in BAD): score-=0.7
    if len(text.split())<60: score-=0.15
    return max(0,min(1,score))
ap=argparse.ArgumentParser();ap.add_argument("--input",required=True);ap.add_argument("--output",required=True);ap.add_argument("--config",required=True);a=ap.parse_args()
cfg=json.loads(pathlib.Path(a.config).read_text());allow=set(cfg.get("sources_allowlist",[]));out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True);seen=set();kept=0
for f in pathlib.Path(a.input).rglob("*"):
    if not f.is_file(): continue
    if f.suffix.lower()==".jsonl": records=[json.loads(x) for x in f.read_text(errors="ignore").splitlines() if x.strip()]
    else: records=[{"text":f.read_text(errors="ignore"),"source_url":""}]
    rows=[]
    for rec in records:
        text=clean(rec.get("text",""));url=str(rec.get("source_url",""));host=urllib.parse.urlparse(url).netloc
        if len(text)<120: continue
        if allow and host and not any(host==a or host.endswith("."+a) for a in allow): continue
        score=quality(text,url);h=hashlib.sha256(text.encode()).hexdigest()
        if score<float(cfg.get("min_quality_score",0.8)) or h in seen: continue
        seen.add(h);rows.append({"text":text,"source_url":url,"quality":score,"sha256":h});kept+=1
    if rows:(out/f"{f.stem}.jsonl").write_text("\n".join(json.dumps(x,ensure_ascii=False) for x in rows)+"\n")
print("curated records:",kept)
