package com.doorstep.tn.common.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LocationUtilsTest {

    @Test
    fun `parseGeoPoint returns point for valid coordinates`() {
        val point = parseGeoPoint("13.0827", "80.2707")

        assertNotNull(point)
        assertEquals(13.0827, point!!.latitude, 0.0001)
        assertEquals(80.2707, point.longitude, 0.0001)
    }

    @Test
    fun `parseGeoPoint returns null for invalid input`() {
        assertNull(parseGeoPoint("invalid", "80.2707"))
        assertNull(parseGeoPoint("13.0827", null))
    }

    @Test
    fun `haversineDistanceKm returns expected range for tamil nadu cities`() {
        val chennaiToCoimbatore = haversineDistanceKm(
            latitude1 = 13.0827,
            longitude1 = 80.2707,
            latitude2 = 11.0168,
            longitude2 = 76.9558
        )

        assertTrue(chennaiToCoimbatore in 350.0..500.0)
    }
}
