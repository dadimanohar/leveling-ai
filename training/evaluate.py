import argparse,json,pathlib
ap=argparse.ArgumentParser();ap.add_argument("--predictions",required=True);a=ap.parse_args()
rows=[json.loads(x) for x in pathlib.Path(a.predictions).read_text().splitlines() if x.strip()]
nonempty=sum(1 for r in rows if str(r.get("response","")).strip())
mean=sum(float(r.get("score",0)) for r in rows)/max(1,len(rows))
print(json.dumps({"records":len(rows),"non_empty":nonempty,"mean_score":mean,"pass":bool(rows and nonempty==len(rows) and mean>=0.7)},indent=2))
