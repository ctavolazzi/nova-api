const apiUrl = 'http://localhost:3000/items';
const chatUrl = 'http://localhost:3000/chat';

document.addEventListener('DOMContentLoaded', () => {
    fetchItems();

    const addItemForm = document.getElementById('item-form');
    addItemForm.addEventListener('submit', (event) => {
        event.preventDefault();
        addItem();
    });

    const updateItemForm = document.getElementById('update-form');
    updateItemForm.addEventListener('submit', (event) => {
        event.preventDefault();
        updateItem();
    });

    const deleteItemForm = document.getElementById('delete-form');
    deleteItemForm.addEventListener('submit', (event) => {
        event.preventDefault();
        deleteItem();
    });

    const chatForm = document.getElementById('chat-form');
    chatForm.addEventListener('submit', (event) => {
        event.preventDefault();
        sendMessage();
    });
});

function fetchItems() {
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            const itemsContainer = document.getElementById('items-container');
            itemsContainer.innerHTML = '';
            data.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'item';
                itemDiv.innerHTML = `
                    <h3>${item.name}</h3>
                    <p>${item.description}</p>
                    <p>ID: ${item.id}</p>
                `;
                itemsContainer.appendChild(itemDiv);
            });
        })
        .catch(error => console.error('Error fetching items:', error));
}

function addItem() {
    const name = document.getElementById('name').value;
    const description = document.getElementById('description').value;

    fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, description })
    })
    .then(response => response.json())
    .then(data => {
        fetchItems();
        document.getElementById('name').value = '';
        document.getElementById('description').value = '';
    })
    .catch(error => console.error('Error adding item:', error));
}

function updateItem() {
    const id = document.getElementById('update-id').value;
    const name = document.getElementById('update-name').value;
    const description = document.getElementById('update-description').value;

    fetch(`${apiUrl}/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, description })
    })
    .then(response => response.json())
    .then(data => {
        fetchItems();
        document.getElementById('update-id').value = '';
        document.getElementById('update-name').value = '';
        document.getElementById('update-description').value = '';
    })
    .catch(error => console.error('Error updating item:', error));
}

function deleteItem() {
    const id = document.getElementById('delete-id').value;

    fetch(`${apiUrl}/${id}`, {
        method: 'DELETE'
    })
    .then(() => {
        fetchItems();
        document.getElementById('delete-id').value = '';
    })
    .catch(error => console.error('Error deleting item:', error));
}

function sendMessage() {
    const chatInput = document.getElementById('chat-input').value;
    const chatBox = document.getElementById('chat-box');

    // Display user message
    const userMessage = document.createElement('div');
    userMessage.className = 'message user';
    userMessage.textContent = chatInput;
    chatBox.appendChild(userMessage);

    // Clear input field
    document.getElementById('chat-input').value = '';

    // Create a new EventSource for this specific chat message
    const eventSource = new EventSource(`${chatUrl}?message=${encodeURIComponent(chatInput)}`);

    // Create a bot message container
    const botMessage = document.createElement('div');
    botMessage.className = 'message bot';
    chatBox.appendChild(botMessage);

    let fullResponse = '';

    eventSource.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            if (data.error) {
                console.error('Error from server:', data.error);
                botMessage.textContent = 'Error: ' + data.error;
                eventSource.close();
            } else if (data.content) {
                fullResponse += data.content;
                botMessage.textContent = fullResponse;
            }
        } catch (error) {
            console.error('Error parsing SSE data:', error);
        }
        chatBox.scrollTop = chatBox.scrollHeight;
    };

    eventSource.onerror = function(error) {
        console.error('EventSource failed:', error);
        eventSource.close();
    };

    eventSource.onopen = function() {
        console.log('SSE connection opened');
    };
}
