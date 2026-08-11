document
.getElementById("bookingForm")
?.addEventListener("submit",async(e)=>{


e.preventDefault();



const formData=new FormData(e.target);



const data={


name:formData.get("name"),

phone:formData.get("phone"),

email:formData.get("email"),

company:formData.get("company"),

service:formData.get("service"),

date:formData.get("date"),

time:formData.get("time"),

budget:formData.get("budget"),

message:formData.get("message")


};



const {error}=await supabaseClient
.from("bookings")
.insert([data]);



if(error){

console.log(error);

alert(
"Booking failed"
);


}else{


alert(
"Booking received. We will contact you."
);


e.target.reset();


}


});