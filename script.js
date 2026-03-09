// Load Events from JSON
async function loadEvents() {

    const eventContainer = document.getElementById("event-list");

    if (!eventContainer) return;

    try {

        const response = await fetch("/data/events.json");
        const events = await response.json();

        eventContainer.innerHTML = "";

        events.forEach(event => {

            const div = document.createElement("div");

            div.classList.add("event-card");

            div.innerHTML = `
                <h3>${event.name}</h3>
                <p>Date: ${event.date}</p>
                <p>Venue: ${event.venue}</p>

                <button onclick="openRegistration('${event.name}')">
                Register
                </button>
            `;

            eventContainer.appendChild(div);

        });

    } catch (error) {

        console.error("Error loading events:", error);

    }
}


// Open Registration Page
function openRegistration(eventName) {

    localStorage.setItem("selectedEvent", eventName);

    window.location.href = "/event-register";

}


// Registration Form Submit
document.addEventListener("DOMContentLoaded", () => {

    loadEvents();

    const form = document.getElementById("registrationForm");

    if (form) {

        form.addEventListener("submit", function (e) {

            e.preventDefault();

            const name = document.getElementById("username").value;
            const email = document.getElementById("email").value;

            alert("Registration Successful!\n\nName: " + name + "\nEmail: " + email);

            form.reset();

        });

    }

});