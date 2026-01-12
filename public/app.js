async function getPosts() {
  const url = "/api/posts";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    const result = await response.json();
    renderPosts(result)
    attachReportEvents();
  } catch (error) {
    console.error(error.message);
  }
}

function attachReportEvents() {
  document.querySelectorAll('.btn-report').forEach(button => {
    button.addEventListener('click', async (e) => {
      const postId = button.getAttribute('data-id');
      console.log(postId)
      if (confirm('Report this post ?')) {
        try {
            const response = await fetch(`/report/${postId}`, { method: 'POST' });
            const result = await response.json();
            if (result.success == true) {
                showMessage('Thank you for your report', 'success');
                getPosts()
            }
            else {
                showMessage('Error during report', 'error');
            }
        } catch {
            showMessage('Error during report', 'error');
        }
      }
    });
  });
} 

function attachFormEvents() {
    const form = document.getElementById('share-form')
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form)

        const data = Object.fromEntries(formData.entries());
        console.log(data)
        try {
            const response = await fetch(`/post/`, { 
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
             });
            const result = await response.json();
            if (result.success == true) {
                showMessage('Successful sharing', 'success');
                getPosts()
                form.reset();
            }
            else {
                showMessage(result.error || 'Unknown error', 'error');
            }
        } catch (error) {
            showMessage(error, 'error');
        }
    })  
        
}

function renderPosts(posts) {
    const container = document.getElementById('posts-container');

    if (!posts || posts.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 bg-gray-800/30 rounded-2xl border border-dashed border-gray-700">
                <div class="text-6xl mb-4">🎵</div>
                <h3 class="text-xl font-bold mb-2 text-white">Aucune musique partagée</h3>
                <p class="text-gray-400">Sois le premier à partager une musique !</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = posts.map(post => {
        const isYouTube = post.songUrl.includes('youtube') || post.songUrl.includes('youtu.be');
        const isSpotify = post.songUrl.includes('spotify');
        const isSoundCloud = post.songUrl.includes('soundcloud');
        
        return `
        <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 mb-6 shadow-lg">
            
            <div class="flex justify-between items-center mb-4">
                <span class="text-gray-400 text-sm">${getPostAgeTime(post.createdAt)}</span>
                <button class="btn-report text-gray-400 hover:text-red-400 px-3 py-1 rounded-lg text-sm hover:bg-red-900/20 transition" data-id="${post.id}">
                    🚩 Report
                </button>
            </div>
            
            <h3 class="text-2xl font-bold text-white mb-5">
                ${post.songTitle}
            </h3>
            
            ${isYouTube ? 
                    `<div class="relative pb-[56.25%] h-0 overflow-hidden rounded-xl">
    ${post.embedCode} <!-- Direct, pas de div intermédiaire -->
</div>` : 
                isSpotify ?
                `<div class="mb-5 w-full min-w-[500px]">
                    ${post.embedCode}
                </div>` :
                
                isSoundCloud ?
                `<div class="mb-5 w-full min-w-[500px]">
                    ${post.embedCode}
                </div>` :
                
                `<div class="mb-5">
                    ${post.embedCode}
                </div>`
            }
            
            <div class="border-gray-700">
                ${generatePlatformBadge(post.songUrl)}
            </div>
            
        </div>`;
    }).join('');
    
}

function showMessage(text, type) {
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    }; 
    
    // Crée ou réutilise un container
    let container = document.getElementById('toast-container');

    const toast = document.createElement('div');

    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-4 right-4 space-y-2 z-50';
        document.body.appendChild(container);
    }

    toast.className = `flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' : 'bg-blue-500'
    } text-white animate-fade-in`;
    
    toast.innerHTML = `
        <span class="text-lg">${icons[type]}</span>
        <span>${text}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
        if (container.children.length === 0) {
            container.remove();
        }
    }, 3000);
}


function getPostAgeTime(createdTime) {
    var minutes
    var today = Date.now()
    var createdTimeConv = new Date(createdTime + 'Z')
    var AgeTime = today - createdTimeConv
    var hours = Math.floor(AgeTime / (1000 * 60 * 60))
    if (hours == 0 )
    {
        minutes =  Math.floor(AgeTime / (1000 * 60 ))
        return `Shared ${minutes} minutes ago`
    }
    
    return `Shared ${hours} hours ago`
}
function generatePlatformBadge(url) {
    console.log(url)
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return '<span class="bg-red-600/20 text-red-300 px-3 py-1 rounded-full text-xs">YouTube</span>';
    } 
    if (url.includes('spotify.com')) {
        return '<span class="bg-green-600/20 text-green-300 px-3 py-1 rounded-full text-xs">Spotify</span>';
    } 
    if (url.includes('soundcloud.com')) {
        return '<span class="bg-orange-600/20 text-orange-300 px-3 py-1 rounded-full text-xs">SoundCloud</span>';
    } 
    return '<span class="bg-gray-600/20 text-gray-300 px-3 py-1 rounded-full text-xs">Other</span>';
    
}


// Initialiser quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    attachFormEvents();
    getPosts();
});
