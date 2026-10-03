import argparse,json,pathlib
def main():
    try:
        import torch
        from datasets import load_dataset
        from transformers import AutoModelForCausalLM,AutoTokenizer,Trainer,TrainingArguments
    except Exception as e: raise SystemExit("Install training/requirements.txt first: "+str(e))
    ap=argparse.ArgumentParser();ap.add_argument("--input",required=True);ap.add_argument("--output",required=True);ap.add_argument("--config",required=True);a=ap.parse_args()
    cfg=json.loads(pathlib.Path(a.config).read_text());files=[str(x) for x in pathlib.Path(a.input).glob("*.jsonl")]
    if not files: raise SystemExit("No curated JSONL files found")
    ds=load_dataset("json",data_files=files,split="train");tok=AutoTokenizer.from_pretrained(cfg["base_model"])
    if tok.pad_token is None: tok.pad_token=tok.eos_token
    def enc(batch): return tok(batch["text"],truncation=True,max_length=int(cfg.get("max_seq_length",4096)))
    data=ds.map(enc,batched=True);split=data.train_test_split(test_size=0.02,seed=42)
    args=TrainingArguments(output_dir=a.output,num_train_epochs=float(cfg.get("epochs",1)),learning_rate=float(cfg.get("learning_rate",2e-5)),per_device_train_batch_size=1,gradient_accumulation_steps=8,logging_steps=10,save_strategy="epoch",report_to="none",bf16=torch.cuda.is_available())
    model=AutoModelForCausalLM.from_pretrained(cfg["base_model"])
    trainer=Trainer(model=model,args=args,train_dataset=split["train"],eval_dataset=split["test"],tokenizer=tok)
    trainer.train();metrics=trainer.evaluate();pathlib.Path(a.output).mkdir(parents=True,exist_ok=True);pathlib.Path(a.output,"eval_metrics.json").write_text(json.dumps(metrics,indent=2));trainer.save_model(a.output);tok.save_pretrained(a.output)
    print(json.dumps(metrics,indent=2))
if __name__=="__main__": main()
