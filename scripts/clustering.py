# C:\ProgramData\anaconda3/python scripts/clustering.py
import numpy as np
import json

f = open('vectors.json', encoding="utf8")
data = json.load(f)
# print(data[0]['tweet'])

vectors = []
for i in range(0, len(data)):
    vectors.append(np.array(data[i]['vector']))
# Example: List of vectors
# vectors = [np.array([1, 2]), # A, 0
#            np.array([1.5, 1.8]), # A, 1
#            np.array([5, 8]), 
#            np.array([8, 8]),
#            np.array([1, 0.6]), # A, 4
#            np.array([9, 11])]

from sklearn.cluster import KMeans

# Number of clusters
k = 100 

# Create KMeans instance
kmeans = KMeans(n_clusters=k)

# Fit the model
kmeans.fit(vectors)

# Get the cluster assignments (labels)
labels = kmeans.labels_

print("Cluster labels:", labels)
tweets = {}

for i in range(0, len(labels)):
    label = int(labels[i])
    if (not label in tweets):
        tweets[label] = []
    tweets[label].append(data[i]['tweet'])


print(json.dumps(tweets, indent=4)) 

