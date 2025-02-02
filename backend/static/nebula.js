// UI State Management
function showLoading(show) {
    document.getElementById('loadingState').classList.toggle('hidden', !show);
}

function renderCompoundCell(compoundId) {
    const root = document.createElement('div');
    const CompoundTooltip = window.CompoundTooltip;
    if (!CompoundTooltip) {
        console.error('CompoundTooltip component not found');
        return document.createTextNode(compoundId);
    }
    ReactDOM.createRoot(root).render(
        React.createElement(CompoundTooltip, { compoundId })
    );
    return root;
}

function showResults(show) {
    document.getElementById('resultsSection').classList.toggle('hidden', !show);
    document.getElementById('downloadBtn').disabled = !show;
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    } else {
        errorDiv.classList.add('hidden');
    }
}

// Data Management
async function fetchECData(ecNumber) {
    try {
        const response = await fetch(`/api/ec/${encodeURIComponent(ecNumber)}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        return data.data;
    } catch (error) {
        console.error('Error fetching EC data:', error);
        return [];
    }
}

function createECListElement(ecList) {
    if (!ecList || ecList.length === 0) return '';
    
    const ecItems = ecList.map(ec => `
        <div class="ec-item group" data-ec="${ec}">
            <div class="flex items-center justify-end gap-2 cursor-pointer">
                <span class="text-blue-600 hover:text-blue-500 transition-colors font-mono text-sm">${ec}</span>
                <i class="fas fa-chevron-down transform transition-transform duration-200"></i>
            </div>
        </div>
    `).join('');

    return `
        <div class="ec-list space-y-1">
            ${ecItems}
        </div>
    `;
}

const UniProtDetails = ({ data = [] }) => {
    if (!data.length) {
        return React.createElement('div', {
            className: 'text-sm text-gray-500 py-2 px-4'
        }, 'No protein data available');
    }

    return React.createElement('div', {
        className: 'bg-white rounded-lg shadow-lg border border-gray-200'
    },
        React.createElement('div', {
            className: 'divide-y divide-gray-100'
        }, data.map(item =>
            React.createElement('div', {
                key: item.primary_accession,
                className: 'p-4 hover:bg-gray-50 transition-colors'
            }, [
                React.createElement('div', {
                    className: 'grid grid-cols-12 gap-4 items-center'
                }, [
                    // Primary Accession & Gene Names
                    React.createElement('div', {
                        className: 'col-span-2'
                    }, [
                        React.createElement('a', {
                            href: `http://prodata.swmed.edu/ecod/af2_pdb/search?kw=${item.primary_accession}`,
                            target: '_blank',
                            rel: 'noopener noreferrer',
                            className: 'text-blue-600 hover:text-blue-500 font-mono text-sm'
                        }, item.primary_accession),
                        item.gene_names && React.createElement('div', {
                            className: 'text-xs text-gray-500 mt-1'
                        }, item.gene_names)
                    ]),
                    
                    // Protein Name
                    React.createElement('div', {
                        className: 'col-span-6'
                    }, 
                        React.createElement('div', {
                            className: 'text-sm text-gray-900'
                        }, item.protein_name || 'Unknown Protein')
                    ),
                    
                    // Organism
                    React.createElement('div', {
                        className: 'col-span-3'
                    },
                        React.createElement('div', {
                            className: 'text-sm text-gray-600 italic'
                        }, item.organism)
                    ),
                    
                    // Length
                    React.createElement('div', {
                        className: 'col-span-1 text-right'
                    },
                        React.createElement('div', {
                            className: 'text-xs text-gray-500'
                        }, `${item.range} aa`)
                    )
                ])
            ])
        ))
    );
};

function createProteinRow(protein) {
    const row = document.createElement('tr');
    row.className = 'protein-detail bg-gray-50';
    row.innerHTML = `
        <td class="py-2"></td>
        <td colspan="7" class="py-2 px-8">
            <div class="flex items-center gap-8">
                <div class="w-32">
                    <a href="http://prodata.swmed.edu/ecod/af2_pdb/search?kw=${protein.primary_accession}" 
                       target="_blank" 
                       class="text-blue-600 hover:text-blue-500 font-mono text-sm">
                        ${protein.primary_accession}
                    </a>
                    ${protein.gene_names ? `<div class="text-xs text-gray-500 mt-1">${protein.gene_names}</div>` : ''}
                </div>
                <div class="flex-1 text-sm text-gray-900">
                    ${protein.protein_name || 'Unknown Protein'}
                </div>
                <div class="w-48 text-sm text-gray-600 italic">
                    ${protein.organism}
                </div>
                <div class="w-20 text-right text-xs text-gray-500">
                    ${protein.length} aa
                </div>
            </div>
        </td>
    `;
    return row;
}


function renderECDetails(container, data) {
    const root = ReactDOM.createRoot(container);
    root.render(React.createElement(UniProtDetails, { data: data }));
}

async function performBacktrace() {
    const target = document.getElementById('backtraceInput').value.trim();
    if (!target) {
        showError('Please enter a compound ID');
        return;
    }

    showError(null);
    showLoading(true);
    showResults(false);

    try {
        const response = await fetch(`/api/backtrace?target=${encodeURIComponent(target)}`);
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        
        renderResults(data.data);
        showResults(true);
    } catch (error) {
        showError(error.message || 'An error occurred while fetching data');
    } finally {
        showLoading(false);
    }
}

function renderResults(data) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';
    
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition duration-150';
        
        // First create all cells except the target and equation cells
        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="text-sm font-medium text-gray-900">
                    ${row.reaction}
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-700">${row.source}</td>
            <td class="px-6 py-4 text-sm text-gray-700">${row.coenzyme}</td>
            <td class="px-6 py-4 text-sm text-gray-700"></td>
            <td class="px-6 py-4 text-sm text-gray-700">${row.transition}</td>
            <td class="px-6 py-4 text-sm text-gray-700"></td>
            <td class="px-6 py-4">
                ${createECListElement(row.ec_list)}
            </td>
            <td class="px-6 py-4 text-sm">
                <a href="${row.reaction_link}" 
                   target="_blank"
                   class="text-blue-600 hover:text-blue-500 transition duration-150 flex items-center gap-2">
                    <i class="fas fa-external-link-alt"></i>
                    View
                </a>
            </td>
        `;

        // Render the target cell with CompoundTooltip
        const targetCell = tr.querySelector('td:nth-child(6)');
        targetCell.appendChild(renderCompoundCell(row.target));

        // Render the equation cell with ReactionTooltip
        const equationCell = tr.querySelector('td:nth-child(4)');
        equationCell.appendChild(renderEquationCell(row.equation));
        
        // Add click handlers for EC items
        tr.querySelectorAll('.ec-item').forEach(ecItem => {
            const chevron = ecItem.querySelector('.fa-chevron-down');
            let detailRow = null;
            let isExpanded = false;
            
            ecItem.addEventListener('click', async function() {
                const ecNumber = this.dataset.ec;
                
                if (!isExpanded) {
                    // Remove any existing detail rows
                    if (detailRow) {
                        detailRow.remove();
                    }
                    
                    // Show loading state
                    detailRow = document.createElement('tr');
                    detailRow.className = 'domain-detail';
                    detailRow.innerHTML = `
                        <td colspan="8" class="p-4">
                            <div class="flex justify-center">
                                <div class="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
                            </div>
                        </td>
                    `;
                    tr.after(detailRow);
                    
                    try {
                        // Fetch domain data
                        const response = await fetch(`/api/ec/${encodeURIComponent(ecNumber)}`);
                        const result = await response.json();
                        
                        if (result.error) {
                            throw new Error(result.error);
                        }
                        
                        // Update the detail row with domain table
                        detailRow.innerHTML = `
                            <td colspan="8">
                                ${createDomainTable(result.data)}
                            </td>
                        `;
                    } catch (error) {
                        detailRow.innerHTML = `
                            <td colspan="8" class="p-4">
                                <div class="text-sm text-red-500">Error loading domain data</div>
                            </td>
                        `;
                        console.error('Error fetching EC data:', error);
                    }
                } else {
                    // Remove detail row when collapsing
                    if (detailRow) {
                        detailRow.remove();
                        detailRow = null;
                    }
                }
                
                // Toggle state
                isExpanded = !isExpanded;
                chevron.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
            });
        });
        
        tableBody.appendChild(tr);
    });
}


async function downloadCSV() {
    try {
        const response = await fetch('/download/csv');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nebula-results.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        showError('Failed to download results');
    }
}

// Add keyboard event listener for search
document.getElementById('backtraceInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        performBacktrace();
    }
});

function createDomainRow(domain) {
    return `
        <tr class="hover:bg-gray-50">
            <td class="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">${domain.organism_name}</td>
            <td class="px-3 py-2 text-sm font-mono text-blue-600 whitespace-nowrap">${domain.domain_id}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${domain.A}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${domain.X}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${domain.H}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${domain.T}</td>
            <td class="px-3 py-2 text-sm text-gray-900">${domain.F}</td>
            <td class="px-3 py-2 text-sm text-gray-900 text-right">${domain.range}</td>
        </tr>
    `;
}

function createDomainTable(data) {
    if (!data || data.length === 0) {
        return '<div class="text-sm text-gray-500 p-4">No domain data available</div>';
    }

    return `
        <div class="overflow-x-auto p-4">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Organism</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Domain ID</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">A</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">X</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">H</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">T</th>
                        <th class="px-3 py-2 text-left text-xs font-medium text-gray-500">F</th>
                        <th class="px-3 py-2 text-right text-xs font-medium text-gray-500">Range</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${data.map(item => `
                        <tr class="hover:bg-gray-50">
                            <td class="px-3 py-2 text-sm text-gray-600">${item.organism_name || ''}</td>
                            <td class="px-3 py-2 text-sm font-mono text-blue-600">${item.domain_id || ''}</td>
                            <td class="px-3 py-2 text-sm text-gray-900">${item.A || ''}</td>
                            <td class="px-3 py-2 text-sm text-gray-900">${item.X || ''}</td>
                            <td class="px-3 py-2 text-sm text-gray-900">${item.H || ''}</td>
                            <td class="px-3 py-2 text-sm text-gray-900">${item.T || ''}</td>
                            <td class="px-3 py-2 text-sm text-gray-900">${item.F || ''}</td>
                            <td class="px-3 py-2 text-sm text-gray-900 text-right">${item.range || ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderEquationCell(equation) {
    const root = document.createElement('div');
    ReactDOM.createRoot(root).render(
        React.createElement(ReactionTooltip, { equation })
    );
    return root;
}


// Find and replace the EC click handler in the renderResults function
tr.querySelectorAll('.ec-item').forEach(ecItem => {
    const chevron = ecItem.querySelector('.fa-chevron-down');
    let detailRow = null;
    let isExpanded = false;
    
    ecItem.addEventListener('click', async function() {
        if (!isExpanded) {
            // Fetch and insert data
            const ecNumber = this.dataset.ec;
            const ecData = await fetchECData(ecNumber);
            
            // Remove existing detail row if any
            if (detailRow) {
                detailRow.remove();
            }
            
            // Create and insert new detail row
            detailRow = document.createElement('tr');
            detailRow.className = 'domain-detail bg-gray-50';
            detailRow.innerHTML = `
                <td colspan="8" class="p-4">
                    ${ecData && ecData.length > 0 
                        ? createDomainTable(ecData)
                        : '<div class="text-sm text-gray-500">No domain data available</div>'}
                </td>
            `;
            tr.after(detailRow);
        } else {
            // Remove detail row
            if (detailRow) {
                detailRow.remove();
                detailRow = null;
            }
        }
        
        // Toggle state
        isExpanded = !isExpanded;
        chevron.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
    });
});