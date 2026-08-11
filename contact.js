document
.getElementById("contactForm")
?.addEventListener("submit", async(e)=>{


e.preventDefault();



const formData = new FormData(e.target);


const data={

name:formData.get("name"),

email:formData.get("email"),

subject:formData.get("subject"),

message:formData.get("message")

};



const {error}=await supabaseClient
.from("contacts")
.insert([data]);



if(error){

console.log(error);

alert(
"Unable to send message"
);


}else{


alert(
"Message sent successfully"
);


e.target.reset();


}


});