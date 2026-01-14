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
            <div class="text-center py-8 sm:py-10 md:py-12 bg-gray-800/30 rounded-xl md:rounded-2xl border border-dashed border-gray-700 mx-2 sm:mx-0">
                <div class="text-4xl sm:text-5xl md:text-6xl mb-3 md:mb-4">🎵</div>
                <h3 class="text-lg sm:text-xl md:text-2xl font-bold mb-2 text-white">No sound shared</h3>
                <p class="text-gray-400 text-sm sm:text-base">Be the first to share your sound !</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = posts.map(post => {
        return `
        <div class="bg-gray-800/50 backdrop-blur-sm rounded-lg md:rounded-xl border border-gray-700 p-4 sm:p-5 md:p-6 mb-4 sm:mb-5 md:mb-6 shadow-lg mx-2 sm:mx-0">
            
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3 sm:mb-4">
                <span class="text-gray-400 text-xs sm:text-sm">${getPostAgeTime(post.createdAt)}</span>
                <button class="btn-report text-gray-400 hover:text-red-400 px-2 py-1 sm:px-3 sm:py-1 rounded-lg text-xs sm:text-sm hover:bg-red-900/20 transition self-end sm:self-auto" data-id="${post.id}">
                    🚩 Report
                </button>
            </div>
            
            <h3 class="text-lg sm:text-xl md:text-2xl font-bold text-white mb-3 sm:mb-4 md:mb-5 break-words">
                ${post.songTitle}
            </h3>
            
            <!-- Container responsive pour les embeds -->
            <div class="mb-4 sm:mb-5 w-full overflow-hidden">
                ${adaptEmbedForMobile(post.embedCode)}
            </div> 
             
            <div class="border-t border-gray-700 pt-3 sm:pt-4">
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
        container.className = 'fixed top-4 right-4 space-y-2 z-50 max-w-xs md:max-w-md';
        document.body.appendChild(container);
    }

    toast.className = `flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-lg shadow-lg ${
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' : 'bg-blue-500'
    } text-white animate-fade-in`;
    
    toast.innerHTML = `
        <span class="text-base sm:text-lg flex-shrink-0">${icons[type]}</span>
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

function adaptEmbedForMobile(embedCode) {
    // Si c'est un iframe Spotify ou SoundCloud, on ajoute des classes responsive
    if (embedCode.includes('<iframe')) {
        return embedCode.replace(
            '<iframe',
            '<iframe class="w-full min-h-[80px] sm:min-h-[152px] md:min-h-[152px] rounded-lg"'
        );
    }
    return embedCode;
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
    if (url.includes('spotify.com')) {
        return '<span class="bg-green-600/20 text-green-300 px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs">Spotify</span>';
    } 
    if (url.includes('soundcloud.com')) {
        return '<span class="bg-orange-600/20 text-orange-300 px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs">SoundCloud</span>';
    } 
    return '<span class="bg-gray-600/20 text-gray-300 px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs">Other</span>';
    
}


// Initialiser quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    attachFormEvents();
    getPosts();
});
