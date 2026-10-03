import argparse,json,pathlib
def main():
    try:
        from datasets import load_dataset
        from transformers import AutoModelForCausalLM,AutoTokenizer,TrainingArguments
        from trl import DPOTrainer
    except Exception as e: raise SystemExit("Install training/requirements.txt first: "+str(e))
    ap=argparse.ArgumentParser();ap.add_argument("--data",required=True);ap.add_argument("--output",required=True);ap.add_argument("--config",required=True);a=ap.parse_args()
    cfg=json.loads(pathlib.Path(a.config).read_text());ds=load_dataset("json",data_files=a.data,split="train")
    if not {"prompt","chosen","rejected"}.issubset(set(ds.column_names)): raise SystemExit("Preference data must contain prompt, chosen and rejected")
    tok=AutoTokenizer.from_pretrained(cfg["base_model"]);model=AutoModelForCausalLM.from_pretrained(cfg["base_model"])
    args=TrainingArguments(output_dir=a.output,num_train_epochs=1,per_device_train_batch_size=1,gradient_accumulation_steps=8,report_to="none")
    trainer=DPOTrainer(model=model,args=args,train_dataset=ds,processing_class=tok)
    trainer.train();trainer.save_model(a.output);tok.save_pretrained(a.output)
if __name__=="__main__": main()
