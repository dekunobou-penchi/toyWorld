

export function timeStamp(): string {
    
    const d = new Date();
    let year = String(d.getFullYear());
    let month = String(d.getMonth() + 1);
    let day = String(d.getDate());
    let hour = String(d.getHours());
    let minutes = String(d.getMinutes());

    if(month.length < 2) {
        month = `0${month}`;
    }
    if(day.length < 2) {
        day = `0${day}`;
    }
    if(hour.length < 2){
        hour = `0${hour}`;
    }
    if(minutes.length < 2){
        minutes = `0${minutes}`;
    }
    const s = `${year}${month}${day}_${hour}${minutes}`;
    return s;
}