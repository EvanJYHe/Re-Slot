class Solution:
    def floodFill(self, image: List[List[int]], sr: int, sc: int, color: int) -> List[List[int]]:

        self.helper(image, sr, sc, color, image[sr][sc])
        
        return image



    def helper(self, image, sr:int, sc: int, color: int, orig: int) -> None:

        if (len(image)-1 < sr or len(image[0])-1 < sc or sr < 0 or sc <0):
            return 
        elif (image[sr][sc] == color):
            return
        elif (image[sr][sc] == orig):
            image[sr][sc] = color
        else: 
            return

        directions = [[1, 0], [-1, 0], [0,1], [0,-1], [0,0]]

        for arr in directions:
            self.helper(image, sr+arr[0], sc+arr[1], color, orig)


        