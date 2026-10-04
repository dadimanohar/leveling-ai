import argparse,json,pathlib,shutil
ap=argparse.ArgumentParser();ap.add_argument("--candidate",required=True);ap.add_argument("--previous",required=True);ap.add_argument("--score",required=True,type=float);ap.add_argument("--manifest",required=True);a=ap.parse_args()
m=json.loads(pathlib.Path(a.manifest).read_text());gate=float(m.get("eval_gate",{}).get("min_score",.70));accepted=a.score>=gate
print(json.dumps({"candidate":a.candidate,"previous":a.previous,"score":a.score,"gate":gate,"accepted":accepted}))
if accepted:
    src=pathlib.Path(a.candidate);dst=pathlib.Path(a.previous);dst.parent.mkdir(parents=True,exist_ok=True)
    if src.is_dir():shutil.copytree(src,dst,dirs_exist_ok=True)
