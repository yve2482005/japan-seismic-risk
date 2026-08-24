export function modelStatusCopy(status: string) {
  if (status === "production") {
    return "ဤခန့်မှန်းချက်သည် စစ်ဆေးပြီးသော model မှ probability အဖြစ်ပြထားခြင်းသာ ဖြစ်ပါသည်။ တရားဝင်သတိပေးချက် မဟုတ်ပါ။";
  }
  return "Data လုံလောက်လာပြီး model ကို စစ်ဆေးအတည်ပြုပြီးမှသာ probability ကို ပြပါမည်။ ယခုအချိန်တွင် အတုခန့်မှန်းချက် မထုတ်ပါ။";
}

export function activityLabel(events: number) {
  if (events === 0) return "မတွေ့ရှိပါ";
  return `${events} ခု`;
}
